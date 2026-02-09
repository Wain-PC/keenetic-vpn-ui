import crypto from "node:crypto";

export function md5(data: string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Keenetic challenge-response: SHA256(challenge + MD5(login:realm:pass)) */
export function computeAuthHash(
  challenge: string,
  login: string,
  realm: string,
  password: string
): string {
  const md5Hash = md5(`${login}:${realm}:${password}`);
  return sha256(`${challenge}${md5Hash}`);
}
