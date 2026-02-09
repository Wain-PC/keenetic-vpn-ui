export interface Device {
  mac: string;
  name: string;
  ip: string;
  hostname: string;
  active: boolean;
  registered: boolean;
  vpnEnabled: boolean;
  policy?: string;
}

export interface HotspotHost {
  mac?: string;
  name?: string;
  ip?: string;
  hostname?: string;
  active?: boolean;
  registered?: boolean;
  policy?: string;
  permit?: boolean;
}

export interface HotspotResponse {
  host?: HotspotHost | HotspotHost[];
}

export interface VpnToggleResult {
  success: boolean;
  verified: boolean;
}
