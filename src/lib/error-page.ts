function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// In development we surface the real error (message + stack) so a failing
// machine is self-diagnosing instead of showing a dead-end page. In production
// we keep the generic, reassuring message.
function devDetails(error?: unknown): string {
  if (process.env.NODE_ENV === "production" || error == null) return "";
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : "";
  return `
    <pre style="text-align:left;max-width:48rem;margin:1.5rem auto 0;padding:1rem;background:#0b1220;color:#e5e7eb;border-radius:0.5rem;overflow:auto;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;">${escapeHtml(
      message,
    )}\n\n${escapeHtml(stack)}</pre>`;
}

export function renderErrorPage(error?: unknown): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 52rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
      ${devDetails(error)}
    </div>
  </body>
</html>`;
}
