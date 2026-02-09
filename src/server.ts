import express from "express";
import path from "node:path";
import { loadConfig } from "./config.js";
import { KeeneticClient } from "./keenetic/client.js";
import { DeviceService } from "./keenetic/device-service.js";
import { createDeviceRoutes } from "./routes/devices.js";

const config = loadConfig();

const client = new KeeneticClient(
  config.routerIp,
  config.routerUser,
  config.routerPass
);
const deviceService = new DeviceService(client, config.vpnPolicy);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/devices", createDeviceRoutes(deviceService));

app.get("/api/health", async (_req, res) => {
  try {
    const healthy = await deviceService.checkHealth();
    const status = healthy ? "ok" : "unreachable";
    res.status(healthy ? 200 : 503).json({ status, router: config.routerIp });
  } catch {
    res.status(503).json({ status: "unreachable", router: config.routerIp });
  }
});

app.listen(config.port, () => {
  console.log(
    `Keenetic VPN Manager running on http://localhost:${config.port}`
  );
  console.log(
    `Router: ${config.routerIp} | User: ${config.routerUser} | Policy: ${config.vpnPolicy}`
  );
});
