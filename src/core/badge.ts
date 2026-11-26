import type { HeartbeatStatus } from "@/contracts/pingpulse";

const STATUS_COLOR: Record<HeartbeatStatus, string> = {
  up: "#10b981",
  degraded: "#f59e0b",
  down: "#ef4444",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Renders a crisp shields.io-style SVG badge showing monitor name, uptime % and status color.
 */
export function renderUptimeBadgeSvg(input: {
  name: string;
  uptimePercent: number;
  status: HeartbeatStatus;
}): string {
  const label = escapeXml(input.name.slice(0, 28));
  const value = `${input.uptimePercent.toFixed(2).replace(/\.00$/, "")}% ${input.status.toUpperCase()}`;
  const labelWidth = Math.max(72, label.length * 6.8 + 16);
  const valueWidth = Math.max(68, value.length * 6.6 + 16);
  const totalWidth = Math.round(labelWidth + valueWidth);
  const color = STATUS_COLOR[input.status];
  const labelCenter = Math.round(labelWidth / 2);
  const valueCenter = Math.round(labelWidth + valueWidth / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${escapeXml(value)}">
  <title>${label}: ${escapeXml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${Math.round(labelWidth)}" height="20" fill="#18181b"/>
    <rect x="${Math.round(labelWidth)}" width="${Math.round(valueWidth)}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system,sans-serif" font-size="11" font-weight="600">
    <text x="${labelCenter}" y="14" fill="#010101" fill-opacity=".35">${label}</text>
    <text x="${labelCenter}" y="13">${label}</text>
    <text x="${valueCenter}" y="14" fill="#010101" fill-opacity=".35">${escapeXml(value)}</text>
    <text x="${valueCenter}" y="13">${escapeXml(value)}</text>
  </g>
</svg>`;
}
