export interface AppConfig {
  routerIp: string;
  routerUser: string;
  routerPass: string;
  vpnPolicy: string;
  port: number;
}

export function loadConfig(): AppConfig {
  const routerPass = process.env.ROUTER_PASS ?? "";

  if (!routerPass) {
    console.error("Error: ROUTER_PASS environment variable is required");
    process.exit(1);
  }

  return {
    routerIp: process.env.ROUTER_IP ?? "192.168.1.1",
    routerUser: process.env.ROUTER_USER ?? "admin",
    routerPass,
    vpnPolicy: process.env.VPN_POLICY ?? "Policy0",
    port: parsePort(process.env.PORT),
  };
}

function parsePort(value: string | undefined): number {
  const port = parseInt(value ?? "3000", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Error: Invalid PORT value "${value}"`);
    process.exit(1);
  }
  return port;
}
