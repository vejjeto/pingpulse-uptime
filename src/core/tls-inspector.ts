import tls from "node:tls";

export type TlsCertStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "unavailable";

export interface TlsCertInfo {
  validTo: string | null;
  daysRemaining: number | null;
  issuer: string | null;
  status: TlsCertStatus;
}

const EXPIRING_SOON_DAYS = 14;

/**
 * Computes TLS expiry status and remaining days from a certificate valid_to date.
 */
export function computeTlsStatus(
  validToInput: string | Date,
  nowMs = Date.now(),
): TlsCertInfo & {
  issuer: null;
} {
  const validToDate =
    validToInput instanceof Date ? validToInput : new Date(validToInput);
  const validToMs = validToDate.getTime();

  if (Number.isNaN(validToMs)) {
    return {
      validTo: null,
      daysRemaining: null,
      issuer: null,
      status: "unavailable",
    };
  }

  const daysRemaining = Math.floor((validToMs - nowMs) / (24 * 3600 * 1000));
  const status: TlsCertStatus =
    daysRemaining < 0
      ? "expired"
      : daysRemaining <= EXPIRING_SOON_DAYS
        ? "expiring_soon"
        : "valid";

  return {
    validTo: validToDate.toISOString(),
    daysRemaining,
    issuer: null,
    status,
  };
}

/**
 * Inspects the peer TLS certificate for an https:// URL with a strict timeout.
 * Returns a deterministic "unavailable" fallback when offline or non-HTTPS.
 */
export async function inspectTlsCertificate(
  rawUrl: string,
  timeoutMs = 2500,
): Promise<TlsCertInfo> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      validTo: null,
      daysRemaining: null,
      issuer: null,
      status: "unavailable",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      validTo: null,
      daysRemaining: null,
      issuer: null,
      status: "unavailable",
    };
  }

  const port = parsed.port ? Number(parsed.port) : 443;
  const host = parsed.hostname;

  return new Promise<TlsCertInfo>((resolve) => {
    let settled = false;
    const finish = (info: TlsCertInfo) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(info);
    };

    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            finish({
              validTo: null,
              daysRemaining: null,
              issuer: null,
              status: "unavailable",
            });
            return;
          }
          const computed = computeTlsStatus(cert.valid_to);
          const issuer =
            typeof cert.issuer?.O === "string"
              ? cert.issuer.O
              : typeof cert.issuer?.CN === "string"
                ? cert.issuer.CN
                : null;
          finish({
            ...computed,
            issuer,
          });
        } catch {
          finish({
            validTo: null,
            daysRemaining: null,
            issuer: null,
            status: "unavailable",
          });
        }
      },
    );

    socket.setTimeout(timeoutMs, () => {
      finish({
        validTo: null,
        daysRemaining: null,
        issuer: null,
        status: "unavailable",
      });
    });

    socket.on("error", () => {
      finish({
        validTo: null,
        daysRemaining: null,
        issuer: null,
        status: "unavailable",
      });
    });
  });
}
