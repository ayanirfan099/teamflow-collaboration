import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { buildOpenApiDocument } from './openapi';

const document = buildOpenApiDocument();

/**
 * Serves the OpenAPI document of the API.
 *
 * `/openapi.json` returns the machine readable document, `/docs` a small self-contained page
 * that lists the endpoints — the page loads no external resources.
 */
@Controller()
export class DocsController {
  @Get('openapi.json')
  @Public()
  @Header('Cache-Control', 'no-store')
  openApiJson(): unknown {
    return document;
  }

  @Get('docs')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  docs(): string {
    const paths = Object.entries(document.paths ?? {})
      .flatMap(([path, operations]) =>
        Object.entries(operations as Record<string, { summary?: string }>)
          .filter(([method]) => method !== 'parameters')
          .map(([method, operation]) => ({
            method: method.toUpperCase(),
            path,
            summary: operation.summary ?? '',
          })),
      )
      .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

    const rows = paths
      .map(
        (entry) =>
          `<tr><td><code>${entry.method}</code></td><td><code>${entry.path}</code></td><td>${
            entry.summary
          }</td></tr>`,
      )
      .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TeamFlow API — reference</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 2rem; font-family: ui-sans-serif, system-ui, sans-serif; background: #faf6f1; color: #2c2724; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  p.lead { color: #6d635a; margin: 0 0 1.5rem; max-width: 60ch; }
  table { border-collapse: collapse; width: 100%; max-width: 70rem; background: #fffdfa; border: 1px solid #e5dacd; border-radius: .75rem; overflow: hidden; }
  th, td { text-align: left; padding: .55rem .8rem; border-bottom: 1px solid #f1e9df; font-size: .875rem; vertical-align: top; }
  th { background: #f1e9df; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: #6d635a; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  a { color: #b24a2e; }
</style>
</head>
<body>
<h1>TeamFlow API</h1>
<p class="lead">Every organization scoped path is tenant isolated: a resource of another organization resolves to <code>404</code>. Requests that change state need the <code>x-csrf-token</code> header with the value of the readable <code>tf_csrf</code> cookie. The machine readable document is available as <a href="./openapi.json">openapi.json</a>.</p>
<table>
<thead><tr><th>Method</th><th>Path</th><th>Summary</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;
  }
}
