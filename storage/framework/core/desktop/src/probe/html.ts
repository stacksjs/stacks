/**
 * The probe page's markup (stacksjs/stacks#877).
 *
 * A TypeScript string rather than an `.html` file because the package build
 * only carries `src/**\/*.ts` into `dist/`; a sibling HTML file would work in
 * this repository and vanish from the published package.
 */

import type { ProbePageConfig } from './payload'

function escapeScript(source: string): string {
  // A literal `</script>` inside the bundle would end the element early.
  return source.replaceAll('</script', '<\\/script')
}

export function probePageHtml(script: string, config: ProbePageConfig): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stacks interactive probe</title>
<style>
  :root { color-scheme: dark; --bg: #0a0d14; --panel: #141a26; --text: #e6e9f0; --muted: #9aa3b5; --accent: #5b8cf2; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  #scene { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
  #hud { position: fixed; left: 16px; right: 16px; top: 16px; padding: 12px 16px; background: color-mix(in srgb, var(--panel) 88%, transparent); border-radius: 10px; }
  #hud h1 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
  #status { color: var(--muted); margin: 0; }
  #interactive { position: fixed; left: 16px; right: 16px; bottom: 16px; padding: 16px; background: var(--panel); border-radius: 10px; }
  #interactive[hidden] { display: none; }
  #interactive p { margin: 0 0 12px; }
  #interactive ol { margin: 0 0 12px; padding-left: 20px; color: var(--muted); }
  button { font: inherit; padding: 8px 14px; margin-right: 8px; border-radius: 8px; border: 1px solid var(--accent); background: transparent; color: var(--text); cursor: pointer; }
  button[disabled] { opacity: 0.4; cursor: default; }
  #countdown { color: var(--muted); margin-top: 10px; }
</style>
</head>
<body>
<canvas id="scene"></canvas>
<div id="hud">
  <h1>Stacks interactive-content probe</h1>
  <p id="status">Starting</p>
</div>
<div id="interactive" hidden>
  <p>These probes need a real person. Synthetic events are ignored, so skipping them records them as needing interaction rather than inventing a number.</p>
  <ol>
    <li>Click <strong>Fullscreen + audio</strong>. It enters fullscreen briefly and resumes audio.</li>
    <li>Click <strong>Pointer lock</strong>. It locks the pointer for half a second.</li>
    <li>Press any key five times, and move the mouse over the window.</li>
  </ol>
  <button id="fullscreen-button" type="button">Fullscreen + audio</button>
  <button id="lock-button" type="button">Pointer lock</button>
  <button id="done-button" type="button">Done</button>
  <div id="countdown"></div>
</div>
<script type="application/json" id="probe-config">${JSON.stringify(config).replaceAll('<', '\\u003c')}</script>
<script type="module">${escapeScript(script)}</script>
</body>
</html>
`
}
