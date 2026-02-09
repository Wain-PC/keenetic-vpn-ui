import { computeAuthHash } from "../utils/crypto.js";

/**
 * Low-level Keenetic RCI HTTP client.
 * Handles cookie-based session management and challenge-response auth.
 * No business logic — just authenticated transport.
 */
const REQUEST_TIMEOUT_MS = 10_000;

export class KeeneticClient {
  private baseUrl: string;
  private user: string;
  private pass: string;
  private cookie: string = "";
  private authMutex: Promise<void> | null = null;

  constructor(routerIp: string, user: string, pass: string) {
    this.baseUrl = `http://${routerIp}`;
    this.user = user;
    this.pass = pass;
  }

  private async authenticate(): Promise<void> {
    // Step 1: GET /auth → challenge + realm headers
    const challengeRes = await fetch(`${this.baseUrl}/auth`, {
      headers: this.cookie ? { Cookie: this.cookie } : {},
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const setCookie = challengeRes.headers.getSetCookie?.() ?? [];
    if (setCookie.length > 0) {
      this.cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    }

    const realm = challengeRes.headers.get("X-NDM-Realm") ?? "";
    const challenge = challengeRes.headers.get("X-NDM-Challenge") ?? "";

    if (!realm || !challenge) {
      throw new Error("Failed to get auth challenge from router");
    }

    // Step 2: compute hash and POST /auth
    const hash = computeAuthHash(challenge, this.user, realm, this.pass);

    const authRes = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: JSON.stringify({ login: this.user, password: hash }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const authCookies = authRes.headers.getSetCookie?.() ?? [];
    if (authCookies.length > 0) {
      this.cookie = authCookies.map((c) => c.split(";")[0]).join("; ");
    }

    if (authRes.status !== 200) {
      throw new Error(
        `Authentication failed (HTTP ${authRes.status}). Check credentials.`
      );
    }
  }

  /** Ensure authenticated, with mutex to prevent concurrent re-auth */
  private async ensureAuth(): Promise<void> {
    if (this.authMutex) {
      await this.authMutex;
      return;
    }

    this.authMutex = this.authenticate().finally(() => {
      this.authMutex = null;
    });

    await this.authMutex;
  }

  /** Authenticated GET request */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  /** Authenticated POST request with JSON body */
  async post<T = unknown>(path: string, body: object): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Make an authenticated request, retrying once on 401 */
  private async request<T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.cookie) {
      await this.ensureAuth();
    }

    const doFetch = async (): Promise<Response> => {
      return fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...((options.headers as Record<string, string>) ?? {}),
          Cookie: this.cookie,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    };

    let res = await doFetch();

    if (res.status === 401) {
      await this.ensureAuth();
      res = await doFetch();
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `RCI request ${path} failed (HTTP ${res.status}): ${body}`
      );
    }

    return (await res.json()) as T;
  }
}
