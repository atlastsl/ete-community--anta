#!/usr/bin/env node
/**
 * Rend un diagramme Mermaid (.mmd) en PNG via Playwright (déjà dans node_modules).
 * Usage : node scripts/render_mermaid.mjs input.mmd output.png
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [, , inputPath, outputPath] = process.argv

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/render_mermaid.mjs <input.mmd> <output.png>')
  process.exit(1)
}

const diagram = readFileSync(inputPath, 'utf8').trim().replace(/<\/pre>/gi, '')
const diagramJson = JSON.stringify(diagram)

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #ffffff; }
    #wrap { display: inline-block; max-width: 100%; }
    .mermaid { font-family: "Segoe UI", system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="wrap"><pre class="mermaid" id="diagram"></pre></div>
  <script>
    document.getElementById('diagram').textContent = ${diagramJson};
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
    });
  </script>
</body>
</html>`

async function launchBrowser() {
  const attempts = [
    () => chromium.launch({ channel: 'chrome' }),
    () => chromium.launch({ channel: 'msedge' }),
    () => chromium.launch(),
  ]
  let lastError
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Navigateur Chromium introuvable')
}

const browser = await launchBrowser()
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 90_000 })
  await page.waitForFunction(() => document.querySelector('.mermaid svg'), { timeout: 90_000 })
  await page.locator('#wrap').screenshot({ path: outputPath, omitBackground: true })
} finally {
  await browser.close()
}
