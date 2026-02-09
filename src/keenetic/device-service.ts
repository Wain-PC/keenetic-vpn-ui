import { KeeneticClient } from "./client.js";
import type {
  Device,
  HotspotHost,
  HotspotResponse,
  VpnToggleResult,
} from "./types.js";

/**
 * Device-level business logic on top of the Keenetic RCI client.
 * Merges runtime + config data, builds RCI payloads, verifies policies.
 */
export class DeviceService {
  constructor(
    private client: KeeneticClient,
    private vpnPolicy: string
  ) {}

  /** Get merged device list with VPN status */
  async getDevices(): Promise<Device[]> {
    const [activeHosts, configHosts] = await Promise.all([
      this.fetchActiveHosts(),
      this.fetchConfigHosts(),
    ]);

    const configMap = new Map<string, HotspotHost>();
    for (const host of configHosts) {
      if (host.mac) {
        configMap.set(host.mac.toLowerCase(), host);
      }
    }

    const deviceMap = new Map<string, Device>();

    // Active devices (merged with config for names/policies)
    for (const host of activeHosts) {
      if (!host.mac) continue;
      const mac = host.mac.toLowerCase();
      const config = configMap.get(mac);

      deviceMap.set(mac, {
        mac,
        name: config?.name || host.name || host.hostname || "",
        ip: host.ip || "",
        hostname: host.hostname || "",
        active: host.active !== false,
        registered: config?.registered !== false && !!config,
        vpnEnabled: this.hasVpnPolicy(config),
        policy: config?.policy,
      });
    }

    // Registered-but-offline devices
    for (const host of configHosts) {
      if (!host.mac) continue;
      const mac = host.mac.toLowerCase();
      if (deviceMap.has(mac)) continue;

      deviceMap.set(mac, {
        mac,
        name: host.name || host.hostname || "",
        ip: host.ip || "",
        hostname: host.hostname || "",
        active: false,
        registered: true,
        vpnEnabled: this.hasVpnPolicy(host),
        policy: host.policy,
      });
    }

    return Array.from(deviceMap.values()).sort(compareDevices);
  }

  /** Enable or disable VPN for a device, then verify */
  async setDeviceVpn(
    mac: string,
    enabled: boolean
  ): Promise<VpnToggleResult> {
    const normalizedMac = mac.toLowerCase();
    const payload = enabled
      ? buildVpnOnPayload(normalizedMac, this.vpnPolicy)
      : buildVpnOffPayload(normalizedMac);

    await this.client.post("/rci/", payload);

    const verified = await this.verifyPolicy(normalizedMac, enabled);
    return { success: true, verified };
  }

  /** Check router connectivity */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.get("/rci/show/version");
      return true;
    } catch {
      return false;
    }
  }

  /** Verify that a device's policy matches the expected state */
  private async verifyPolicy(
    mac: string,
    vpnEnabled: boolean
  ): Promise<boolean> {
    const hosts = await this.fetchConfigHosts();
    const host = hosts.find(
      (h) => h.mac?.toLowerCase() === mac
    );

    if (!host) return false;

    return vpnEnabled
      ? host.policy === this.vpnPolicy
      : !host.policy || host.policy === "";
  }

  /** Fetch active (online) devices from show/ip/hotspot */
  private async fetchActiveHosts(): Promise<HotspotHost[]> {
    const data = await this.client.get<HotspotResponse>(
      "/rci/show/ip/hotspot"
    );
    return normalizeHosts(data);
  }

  /** Fetch device configs (registered devices) from ip/hotspot */
  private async fetchConfigHosts(): Promise<HotspotHost[]> {
    const data = await this.client.get<HotspotResponse>("/rci/ip/hotspot");
    return normalizeHosts(data);
  }

  private hasVpnPolicy(host?: HotspotHost): boolean {
    return host?.policy === this.vpnPolicy;
  }
}

// ── Pure helper functions ─────────────────────────────────

/** Normalize the host field which can be a single object or an array */
function normalizeHosts(data: HotspotResponse): HotspotHost[] {
  if (!data?.host) return [];
  return Array.isArray(data.host) ? data.host : [data.host];
}

/** Sort: active first, then alphabetically by name/mac */
function compareDevices(a: Device, b: Device): number {
  if (a.active !== b.active) return a.active ? -1 : 1;
  return (a.name || a.mac).localeCompare(b.name || b.mac);
}

function buildVpnOnPayload(mac: string, policy: string): object {
  return {
    ip: {
      hotspot: {
        host: { mac, permit: true, policy },
      },
    },
    system: { configuration: { save: {} } },
  };
}

function buildVpnOffPayload(mac: string): object {
  return {
    ip: {
      hotspot: {
        host: { mac, policy: { no: true } },
      },
    },
    system: { configuration: { save: {} } },
  };
}
