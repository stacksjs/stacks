import type { DesktopLauncherConfig } from '@stacksjs/types'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { runBuildStep } from './run-build-step'

const assetOrigin = 'https://desktop.invalid'

/** Copy the selected pages and trace their local assets. Keep generated chunks for dynamic imports. */
export async function stageLauncherViews(source: string, destination: string, routes: string[]): Promise<void> {
  const root = resolve(source)
  const files = [...new Bun.Glob('**/*').scanSync({ cwd: root, onlyFiles: true })]
  const available = new Set(files)
  const prefixes = routes.map(route => route.replace(/^\/+|\/+$/g, ''))
  const pages = files.filter(file => file.endsWith('.html') && prefixes.some(prefix =>
    !prefix || file === `${prefix}.html` || file.startsWith(`${prefix}/`)))
  if (!pages.length) throw new Error('The desktop build rendered no pages for the declared routes')

  const pending = [...pages, ...files.filter(file => /\.(?:css|m?js|json|woff2?|ttf)$/.test(file))]
  const copied = new Set<string>()

  function include(reference: string, parent: string): void {
    if (!reference || reference.startsWith('#')) return
    const url = new URL(reference, `${assetOrigin}/${parent}`)
    if (url.origin !== assetOrigin || url.pathname.startsWith('/api/')) return
    const file = decodeURIComponent(url.pathname).replace(/^\//, '')
    if (!resolve(root, file).startsWith(`${root}${sep}`))
      throw new Error(`Desktop asset escapes the rendered site: ${reference}`)
    if (!available.has(file))
      throw new Error(`${parent} references a missing desktop asset: ${reference}`)
    pending.push(file)
  }

  while (pending.length) {
    const file = pending.pop()!
    if (copied.has(file)) continue
    copied.add(file)
    const input = join(root, file)
    const output = join(destination, file)
    mkdirSync(dirname(output), { recursive: true })
    cpSync(input, output)
    if (!/\.(?:html|css)$/.test(file)) continue
    const content = await Bun.file(input).text()
    if (file.endsWith('.html')) {
      await new HTMLRewriter().on('script[src], link[rel="stylesheet"][href], link[rel="icon"][href], link[rel="preload"][href], img[src], source[src]', {
        element(element) {
          include(element.getAttribute('src') ?? element.getAttribute('href') ?? '', file)
        },
      }).transform(new Response(content)).text()
    }
    for (const match of content.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g))
      include(match[1]!, file)
  }
}

export async function stageLauncherResources(root: string, destination: string, config: DesktopLauncherConfig): Promise<void> {
  for (const [name, path] of Object.entries(config.resources ?? {})) {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name === 'web' || name === 'migrations')
      throw new Error(`Invalid desktop resource name: ${name}`)
    mkdirSync(destination, { recursive: true })
    cpSync(resolve(root, path), join(destination, name), { recursive: true })
  }

  const view = config.views
  if (view) {
    if (view.clientScripts) {
      const source = resolve(root, view.clientScripts)
      const entrypoints = readdirSync(source, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
        .map(entry => join(source, entry.name))
      if (entrypoints.length) {
        const compiled = await Bun.build({ entrypoints, outdir: join(root, 'public'), root: source, target: 'browser', format: 'iife', minify: true })
        if (!compiled.success)
          throw new Error('Building desktop client scripts failed', { cause: compiled.logs })
      }
    }
    const out = mkdtempSync(join(tmpdir(), 'stacks-desktop-views-'))
    const clean = () => rmSync(out, { recursive: true, force: true })
    process.once('exit', clean)
    try {
      await runBuildStep(['bunx', '--bun', '@stacksjs/stx', 'build', '--pages', 'resources/views', '--out', out], {
        cwd: root,
        env: { ...process.env, ...view.env, NODE_ENV: 'production', APP_ENV: 'production' },
        describe: 'Rendering desktop views',
      })
      await stageLauncherViews(out, join(destination, 'web'), view.routes)
    }
    finally {
      process.off('exit', clean)
      clean()
    }
  }
  if (config.sqliteMigrations) {
    const { regenerateMigrationCorpus } = await import('@stacksjs/database')
    // A bundled schema is a build artifact. Generate it outside the checkout
    // so the source migration generator never registers it in Git.
    const dir = mkdtempSync(join(tmpdir(), 'stacks-desktop-migrations-'))
    try {
      const result = await regenerateMigrationCorpus({ dialect: 'sqlite', dir })
      if (result.isErr) throw result.error
      cpSync(dir, join(destination, 'migrations'), { recursive: true })
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
