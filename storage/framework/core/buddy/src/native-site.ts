import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** A native project's website uses its own stx config, compiler and CSS pipeline. */
export async function runNativeSiteCommand(root: string, command: string, flags: string[]): Promise<void> {
  if (!['dev', 'build'].includes(command))
    throw new Error('--site supports buddy dev and buddy build. Desktop packaging uses craft.config.ts.')
  if (flags.includes('--help') || flags.includes('-h')) {
    console.log('buddy dev --site [--port N]\nbuddy build --site\n\nWebsite pages: stx.config.ts root/pagesDir. Static assets: publicDir. Output: dist/site. Desktop entry: craft.config.ts.')
    return
  }
  let port = 3000
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index]
    if (flag === '--site') continue
    if (command === 'dev' && flag === '--port') {
      const value = flags[++index]
      if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
        throw new Error('--port requires an integer from 1 to 65535')
      port = Number(value)
      continue
    }
    throw new Error(`Unsupported website option: ${flag}`)
  }
  const load = (entry: string) => import(pathToFileURL(Bun.resolveSync(`@stacksjs/stx/${entry}`, root)).href)
  if (command === 'build') {
    const { buildApp } = await load('build')
    // Cleaning the website must never remove the sibling signed app bundle.
    const outputDir = join(root, 'dist/site')
    const result = await buildApp({ root, ssg: { outputDir }, ssr: { outputDir } })
    if (result.ssg?.failedCount)
      throw new Error('Website build failed. See the stx diagnostics above.')
    console.log(`Built website: ${outputDir}`)
    return
  }
  const { serveApp } = await load('dev-server')
  if (!await serveApp(root, { port, hostname: '127.0.0.1', native: false }))
    throw new Error('Website development server could not start. Configure website pages in stx.config.ts.')
  // The native command dispatcher exits after completed commands. Keep this
  // command alive; stx owns the server, watchers and Ctrl+C cleanup.
  await new Promise<void>(() => {})
}
