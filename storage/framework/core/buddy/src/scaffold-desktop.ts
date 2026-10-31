import type { AppIdentity } from './scaffold-app'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * `buddy new <name> --desktop`: a Stacks app that is also a native Mac app.
 * Its stx screens are drawn by Craft's AppKit host, and its API runs inside
 * the app (`macos.agent`), so the app needs no server to work. The files
 * below are the smallest working version of that: one screen that calls one
 * route the agent serves, and the scripts that build and open it.
 *
 * Writes only what is missing, so running it over an app that already has a
 * `config/desktop.ts` (or a screen of its own) changes nothing it holds.
 */

export const DESKTOP_SCRIPTS: Record<string, string> = {
  'dev:desktop': './buddy dev:desktop',
  'build:desktop': './buddy build:desktop',
}

export function desktopScaffoldFiles(identity: AppIdentity): Record<string, string> {
  const name = JSON.stringify(identity.displayName)
  return {
    'config/desktop.ts': `import type { DesktopConfig } from '@stacksjs/types'

/**
 * The Mac app: the stx screens in resources/native, drawn by Craft's AppKit
 * host (no web view), with this project's API running inside the app.
 *
 * \`agent: true\` starts the routes on 127.0.0.1 when the app opens and points
 * the window at them: \`routes/api.ts\` (under /api) and the agent's own routes
 * in app/Desktop/Agent.ts. Only the app's own window can call them.
 *
 * \`bun run dev:desktop\` builds the screens and opens the app;
 * \`bun run build:desktop\` builds a signed \`.app\` in storage/framework/desktop/macos.
 */
export default {
  macos: {
    appName: ${name},
    bundleId: ${JSON.stringify(identity.bundleId)},
    agent: true,
    nativeScreens: ['Main'],
    window: { width: 1100, height: 720, minWidth: 720, minHeight: 480 },
  },
} satisfies DesktopConfig
`,
    'resources/native/Main.stx': `<script client>
// A native screen: AppKit views, not HTML. \`fetch\` with a relative URL goes
// to the app's agent, which answers from app/Desktop/Agent.ts and routes/.
const status = state('Starting...')

onMount(async () => {
  try {
    const response = await fetch('/api/desktop/status')
    const body = await response.json()
    status.set(\`\${body.app} is running its own API on this Mac.\`)
  }
  catch {
    status.set('The agent did not answer. Is the app running from buddy dev:desktop?')
  }
})
</script>

<View class="flex-1 flex-col gap-3 items-center justify-center p-8" testID="main">
  <Text class="font-semibold text-[22px]" :text="'${identity.displayName}'" />
  <Text class="text-[13px]" style="color: secondaryLabel" :text="status()" testID="main-status" />
</View>
`,
    'app/Desktop/Agent.ts': `import { response, route } from '@stacksjs/router'

/**
 * Routes only the desktop app serves. They run inside the app, on 127.0.0.1,
 * next to everything in routes/ - which is mounted as \`app/Routes.ts\` says
 * (\`routes/api.ts\` under /api). These are not prefixed: write the full path.
 *
 * Whatever this file imports is compiled into the built app.
 */
route.get('/api/desktop/status', () => response.json({ app: ${name}, ok: true }))
`,
  }
}

/** Write the desktop files and scripts the app does not already have. Returns the paths written. */
export function scaffoldDesktopApp(root: string, identity: AppIdentity): string[] {
  const written: string[] = []
  for (const [file, content] of Object.entries(desktopScaffoldFiles(identity))) {
    const target = join(root, file)
    if (existsSync(target)) continue
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    written.push(file)
  }

  const manifest = join(root, 'package.json')
  if (existsSync(manifest)) {
    const source = readFileSync(manifest, 'utf8')
    const pkg = JSON.parse(source) as { scripts?: Record<string, string> }
    const missing = Object.entries(DESKTOP_SCRIPTS).filter(([script]) => !pkg.scripts?.[script])
    if (missing.length) {
      pkg.scripts = { ...pkg.scripts, ...Object.fromEntries(missing) }
      const indent = /^\{\n(\s+)"/.exec(source)?.[1] ?? '  '
      writeFileSync(manifest, `${JSON.stringify(pkg, null, indent)}\n`)
      written.push('package.json')
    }
  }
  return written
}
