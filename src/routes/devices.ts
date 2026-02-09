import { Router } from "express";
import type { DeviceService } from "../keenetic/device-service.js";

const MAC_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;

export function createDeviceRoutes(deviceService: DeviceService): Router {
  const router = Router();

  // GET /api/devices — list all devices with VPN status
  router.get("/", async (_req, res) => {
    try {
      const devices = await deviceService.getDevices();
      res.json(devices);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
      res.status(500).json({ error: "Failed to fetch devices from router" });
    }
  });

  // POST /api/devices/:mac/vpn — toggle VPN for a device
  router.post("/:mac/vpn", async (req, res) => {
    const { mac } = req.params;
    const { enabled } = req.body;

    if (!MAC_RE.test(mac)) {
      res.status(400).json({ error: "Invalid MAC address format" });
      return;
    }

    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: '"enabled" must be a boolean' });
      return;
    }

    try {
      const result = await deviceService.setDeviceVpn(mac, enabled);
      res.json(result);
    } catch (err) {
      console.error(`Failed to set VPN for ${mac}:`, err);
      res.status(500).json({ error: `Failed to set VPN for ${mac}` });
    }
  });

  return router;
}
