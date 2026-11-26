import { lookup as defaultLookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface SsrfValidationResult {
  allowed: boolean;
  normalizedUrl?: string;
  resolvedIp?: string;
  reason?: string;
}

export interface SsrfValidationOptions {
  lookup?: typeof defaultLookup | undefined;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  ) {
    return true;
  }
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8 RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC 1918
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC 1918
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0] ?? "";
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const mappedV4 = normalized.slice(7);
    if (isIP(mappedV4) === 4) return isPrivateIpv4(mappedV4);
  }
  // ULA fc00::/7 (fc.. or fd..) and link-local fe80::/10 (fe8., fe9., fea., feb.)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/i.test(normalized)) return true;
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const cleaned = ip.replace(/^\[|\]$/g, "");
  const version = isIP(cleaned);
  if (version === 4) return isPrivateIpv4(cleaned);
  if (version === 6) return isPrivateIpv6(cleaned);
  return true;
}

export async function validateSafeExternalUrl(
  rawUrl: string,
  options?: SsrfValidationOptions,
): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { allowed: false, reason: "URL malformada" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      allowed: false,
      reason: `Protocolo no permitido (${parsed.protocol}). Solo http/https.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      allowed: false,
      reason: "Credenciales embebidas en URL no permitidas",
    };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) {
    return { allowed: false, reason: "Hostname vacío" };
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return {
      allowed: false,
      reason: `Hostname interno bloqueado por SSRF guard: ${hostname}`,
    };
  }

  if (isIP(hostname) !== 0) {
    if (isPrivateIp(hostname)) {
      return {
        allowed: false,
        reason: `IP privada o reservada bloqueada por SSRF guard: ${hostname}`,
      };
    }
    return {
      allowed: true,
      normalizedUrl: parsed.toString(),
      resolvedIp: hostname,
    };
  }

  const dnsLookup = options?.lookup ?? defaultLookup;
  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) {
      return { allowed: false, reason: `Sin registros DNS para ${hostname}` };
    }
    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return {
          allowed: false,
          reason: `DNS resolvió a IP privada/reservada (${record.address}) — bloqueado por SSRF guard`,
        };
      }
    }
    const firstIp = records[0]?.address;
    return {
      allowed: true,
      normalizedUrl: parsed.toString(),
      ...(firstIp ? { resolvedIp: firstIp } : {}),
    };
  } catch (err) {
    return {
      allowed: false,
      reason: `Error resolviendo DNS para ${hostname}: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
