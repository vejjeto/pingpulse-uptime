import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PingPulse — Uptime, Latencia P95 & Status Pages",
  description:
    "Monitor de disponibilidad HTTP con guard anti-SSRF, percentiles P50/P95/P99, máquina de incidentes y webhooks HMAC-SHA256.",
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: zero-FOUC theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
