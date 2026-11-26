import type { z } from "zod";

export interface OpenApiRouteDef {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  tag: string;
  summary: string;
  requestSchema?: z.ZodTypeAny;
}

export interface OpenApiConfig {
  title: string;
  version: string;
  description: string;
  serverUrl: string;
  routes: readonly OpenApiRouteDef[];
}

export function buildOpenApiSpec(config: OpenApiConfig) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of config.routes) {
    const pathEntry = paths[route.path] ?? {};
    const operation: Record<string, unknown> = {
      tags: [route.tag],
      summary: route.summary,
      responses: {
        "200": { description: "Successful response" },
        "400": { description: "RFC 7807 Problem Details (Validation / SSRF)" },
      },
    };

    if (route.requestSchema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      };
    }

    pathEntry[route.method] = operation;
    paths[route.path] = pathEntry;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: config.title,
      version: config.version,
      description: config.description,
    },
    servers: [{ url: config.serverUrl }],
    paths,
  };
}

export function renderOpenApiDocsHtml(options: {
  title: string;
  specUrl: string;
  spec: ReturnType<typeof buildOpenApiSpec>;
}): string {
  const rows = Object.entries(options.spec.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, op]) => {
        const meta = op as { summary?: string; tags?: string[] };
        return `<tr>
          <td><span class="method ${method}">${method.toUpperCase()}</span></td>
          <td><code>${path}</code></td>
          <td>${meta.tags?.[0] ?? "API"}</td>
          <td>${meta.summary ?? ""}</td>
        </tr>`;
      }),
    )
    .join("\n");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${options.title} — OpenAPI 3.1</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; margin: 0; padding: 2rem; }
    main { max-width: 960px; margin: 0 auto; }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: #a1a1aa; font-size: 0.9rem; }
    a { color: #818cf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; background: #111114; border: 1px solid #27272a; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #27272a; font-size: 0.85rem; }
    th { color: #a1a1aa; font-weight: 600; background: #18181b; }
    .method { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem; }
    .get { background: rgba(16,185,129,0.15); color: #34d399; }
    .post { background: rgba(99,102,241,0.15); color: #818cf8; }
    .delete { background: rgba(244,63,94,0.15); color: #fb7185; }
    code { font-family: ui-monospace, monospace; color: #e4e4e7; }
  </style>
</head>
<body>
  <main>
    <h1>${options.title}</h1>
    <p>${options.spec.info.description} · <a href="${options.specUrl}">OpenAPI 3.1 JSON</a></p>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Tag</th><th>Summary</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}
