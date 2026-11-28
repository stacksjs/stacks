import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { readProjectService } from '@stacksjs/path'
import { findRestartControl } from '../src/dev/app-session-control'
import { runningDashboardInstance } from '../src/dev/dashboard-restart'

async function until(check: () => Promise<void>, timeout = 20_000): Promise<void> {
  const deadline = Date.now() + timeout
  for (;;) {
    try {
      await check()
      return
    }
    catch (error) {
      if (Date.now() >= deadline)
        throw error
      await Bun.sleep(50)
    }
  }
}

test.skipIf(process.env.STACKS_BROWSER_TESTS !== '1')('dashboard keeps page state through backend edits and Software Update Restart Now', async () => {
  const { launch } = await import('../../testing/src/browser')
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-hmr-'))
  const profile = await mkdtemp(join(tmpdir(), 'stacks-dashboard-hmr-chrome-'))
  const home = join(root, 'machine')
  const source = join(root, 'app/version.ts')
  const configFile = join(root, 'config/editor-probe.ts')
  const entry = join(checkout, 'storage/framework/core/actions/src/dev/dashboard.ts')
  let child: ReturnType<typeof Bun.spawn> | undefined
  let browser: Awaited<ReturnType<typeof launch>> | undefined
  try {
    await Promise.all(['app', 'config', 'resources/views/dashboard', 'routes', 'storage/framework'].map(dir => mkdir(join(root, dir), { recursive: true })))
    const linkType = process.platform === 'win32' ? 'junction' : 'dir'
    await Promise.all([
      symlink(join(checkout, 'node_modules'), join(root, 'node_modules'), linkType),
      cp(join(checkout, 'storage/framework/defaults'), join(root, 'storage/framework/defaults'), {
        recursive: true,
        filter: path => basename(path) !== 'node_modules',
      }),
      writeFile(join(root, 'package.json'), '{"name":"dashboard-hmr-fixture"}'),
      writeFile(join(root, 'bunfig.toml'), 'preload = []\n'),
      writeFile(join(root, 'config/app.ts'), 'export default {}'),
      writeFile(configFile, 'export default { nested: { port: 3000 } }'),
      writeFile(join(root, 'routes/api.ts'), 'export {}'),
      writeFile(source, 'export default "before"'),
      writeFile(join(root, 'resources/views/dashboard/swap-probe.stx'), `
@extends('layouts/default')
<script server>
import version from '../../../app/version'
</script>
<script client>
const count = state(0)
function increment() { count.update(value => value + 1) }
</script>
@section('content')
<p id="version">{{ version }}</p>
<button id="count" @click="increment" :text="count()"></button>
<input id="draft">
<div id="list" style="height:50px;overflow:auto"><p style="height:500px">Scrollable list</p></div>
@endsection
`),
    ])
    child = Bun.spawn([
      process.execPath, '--no-env-file', '--tsconfig-override',
      join(checkout, 'storage/framework/tsconfig.framework.json'), entry,
    ], {
      cwd: root,
      env: {
        ...process.env,
        APP_ENV: 'test', NODE_ENV: 'test', APP_URL: 'http://127.0.0.1', PORT_ADMIN: '0',
        STACKS_HOME: home, STACKS_DASHBOARD_WORKER: '0', STACKS_NO_NATIVE: '1', STACKS_DEV_LOCALHOST: '1',
        STACKS_DEV_SERVER: '1', STACKS_DEV_AUTO_MIGRATE: '0', STACKS_SKIP_DEFAULT_ROUTES: '1',
        DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'fixture.sqlite'),
      },
      stdout: 'ignore',
      stderr: 'inherit',
    })
    await until(async () => {
      expect(child?.exitCode).toBeNull()
      const service = readProjectService(root, 'dashboard')
      expect(service?.restartInstance).toBeTruthy()
      expect(findRestartControl(root, 'dashboard', service!.pid)).toBeTruthy()
      expect(await runningDashboardInstance(service!.port)).toBe(service!.restartInstance!)
    }, 35_000)
    const { url, pid, port, restartInstance } = readProjectService(root, 'dashboard')!
    const origin = new URL(url).origin
    const updateUrl = origin + '/__buddy/software-update'
    const initial = await fetch(updateUrl)
    expect(initial.status).toBe(200)
    const project = (await initial.json()).projects.find((project: { current: boolean }) => project.current)
    expect(project).toBeDefined()
    const updateDir = join(home, 'buddy/software-update')
    // Seed an installed update so the real button can run without upgrading the fixture.
    const db = new Database(join(updateDir, 'status.sqlite'))
    try {
      const target = { id: project.id, name: project.name, version: '0.1.0' }
      db.run('INSERT INTO software_update (id, body) VALUES (1, ?)', [JSON.stringify({
        workerPid: 0,
        targets: [{ ...target, root }],
        report: { id: 'installed-update', running: false, logFile: join(updateDir, 'buddy.log'), projects: [{ ...target, status: 'complete' }] },
      })])
    }
    finally {
      db.close()
    }

    browser = await launch({ quietLiveReload: false, profile })
    const { cdp } = browser
    await cdp.send('Network.enable')
    let streams = 0
    let settingsFragment = false
    const settingsUrl = origin + '/settings/software-update'
    cdp.on('Network.responseReceived', ({ response }) => {
      if (response.url === origin + '/_stx/hmr')
        streams++
      if (response.url.startsWith(settingsUrl) && Object.entries(response.headers).some(([name, value]) => name.toLowerCase() === 'x-stx-fragment' && value === 'true'))
        settingsFragment = true
    })
    await cdp.send('Page.navigate', { url: origin + '/swap-probe' })
    await until(async () => {
      expect(streams).toBe(1)
      expect(await cdp.evaluate("document.querySelector('#version')?.textContent")).toBe('before')
      expect(await cdp.evaluate("document.querySelector('#count')?.textContent")).toBe('0')
    })
    await cdp.evaluate(`
      window.dashboardDocument = 'probe'
      document.querySelector('#count').click()
      const draft = document.querySelector('#draft')
      draft.value = 'unsaved notes'
      draft.focus()
      draft.setSelectionRange(2, 7)
      document.querySelector('#list').scrollTop = 55
    `)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('#count')?.textContent")).toBe('1')
    })
    await writeFile(source, 'export default "after"')
    let edited: string | null = null
    await until(async () => {
      edited = await runningDashboardInstance(port)
      expect(edited).toBeTruthy()
      expect(edited).not.toBe(restartInstance!)
      expect(streams).toBeGreaterThan(1)
      expect(await cdp.evaluate("document.querySelector('#version')?.textContent")).toBe('after')
    })
    expect(await cdp.evaluate(`({
      document: window.dashboardDocument,
      count: document.querySelector('#count').textContent,
      draft: document.querySelector('#draft').value,
      focus: document.activeElement.id,
      selection: [document.activeElement.selectionStart, document.activeElement.selectionEnd],
      scroll: document.querySelector('#list').scrollTop,
    })`)).toEqual({ document: 'probe', count: '1', draft: 'unsaved notes', focus: 'draft', selection: [2, 7], scroll: 55 })
    const beforeSettings = streams
    const restartSelector = '[data-setting="restart-updated-projects"] button'
    await cdp.send('Page.navigate', { url: settingsUrl })
    await until(async () => {
      expect(streams).toBeGreaterThan(beforeSettings)
      expect(await cdp.evaluate(`document.querySelector(${JSON.stringify(restartSelector)})?.textContent.trim()`)).toBe('Restart Now')
    })
    const settingsStreams = streams
    await cdp.evaluate(`
      window.dashboardDocument = 'settings'
      const search = document.querySelector('[aria-label="Search settings"]')
      search.value = 'software'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      search.focus()
      document.querySelector(${JSON.stringify(restartSelector)}).click()
    `)
    await until(async () => {
      const instance = await runningDashboardInstance(port)
      expect(instance).toBeTruthy()
      expect(instance).not.toBe(edited!)
      expect(streams).toBeGreaterThan(settingsStreams)
      expect(settingsFragment).toBe(true)
      expect(await cdp.evaluate("document.body.textContent.includes('The updated projects restarted.')")).toBe(true)
    }, 35_000)
    expect(readProjectService(root, 'dashboard')).toMatchObject({ pid, port })
    expect(await cdp.evaluate(`({
      document: window.dashboardDocument,
      pathname: location.pathname,
      query: document.querySelector('[aria-label="Search settings"]').value,
      focus: document.activeElement.getAttribute('aria-label'),
    })`)).toEqual({ document: 'settings', pathname: '/settings/software-update', query: 'software', focus: 'Search settings' })

    // A real configuration edit restarts the worker. The selected file and
    // save acknowledgement must survive that refresh.
    const configHeading = 'config/editor-probe.ts'
    await cdp.send('Page.navigate', { url: origin + '/settings' })
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('[data-config-path]')?.textContent")).toBe('config/app.ts')
      expect(await cdp.evaluate(`Boolean(document.querySelector('a[href="/settings/config/custom"]'))`)).toBe(true)
    })
    await cdp.evaluate(`
      const search = document.querySelector('[aria-label="Search settings"]')
      const sidebar = document.querySelector('.dashboard-settings-sidebar')
      const toolbar = document.querySelector('.dashboard-settings-toolbar')
      window.settingsChrome = { search, sidebar, toolbar, transitions: 0 }
      const transition = document.startViewTransition
      if (transition) {
        document.startViewTransition = (...args) => {
          window.settingsChrome.transitions++
          return transition.apply(document, args)
        }
      }
    `)
    await cdp.evaluate(`document.querySelector('a[href="/settings/config/custom"]').click()`)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('.dashboard-config-field input')?.value")).toBe('3000')
    })
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('.dashboard-settings-toolbar h1')?.textContent")).toBe('Custom Configuration')
    })
    const checkChrome = () => cdp.evaluate(`({
      sidebar: window.settingsChrome.sidebar === document.querySelector('.dashboard-settings-sidebar'),
      search: window.settingsChrome.search === document.querySelector('[aria-label="Search settings"]'),
      toolbar: window.settingsChrome.toolbar === document.querySelector('.dashboard-settings-toolbar'),
      animations: window.settingsChrome.transitions,
      transitionsDisabled: window.STX_ROUTER_OPTIONS?.viewTransitions === false,
      progressBar: Boolean(document.querySelector('#stx-router-progress')),
    })`)
    expect(await checkChrome()).toEqual({ sidebar: true, search: true, toolbar: true, animations: 0, transitionsDisabled: true, progressBar: false })
    await cdp.evaluate(`document.querySelector('.dashboard-settings-toolbar [aria-label="Back"]').click()`)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('.dashboard-settings-toolbar h1')?.textContent")).toBe('General')
    })
    await cdp.evaluate(`document.querySelector('.dashboard-settings-toolbar [aria-label="Forward"]').click()`)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('.dashboard-settings-toolbar h1')?.textContent")).toBe('Custom Configuration')
    })
    expect(await checkChrome()).toEqual({ sidebar: true, search: true, toolbar: true, animations: 0, transitionsDisabled: true, progressBar: false })
    await cdp.evaluate(`document.activeElement.blur()`)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'f', code: 'KeyF', modifiers: 2, windowsVirtualKeyCode: 70 })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'f', code: 'KeyF', modifiers: 2, windowsVirtualKeyCode: 70 })
    await until(async () => {
      expect(await cdp.evaluate("document.activeElement.getAttribute('aria-label')")).toBe('Search settings')
    })
    const beforeConfigSave = await runningDashboardInstance(port)
    await cdp.evaluate(`
      const input = document.querySelector('.dashboard-config-field input')
      input.value = '3001'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    `)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('.dashboard-settings-pane button[type=submit]')?.disabled")).toBe(false)
    })
    await cdp.evaluate(`document.querySelector('nav[aria-label="Settings"] a[href="/settings"]').click()`)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('[data-config-path]')?.textContent")).toBe('config/app.ts')
    })
    await cdp.evaluate(`document.querySelector('a[href="/settings/config/custom"]').click()`)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('.dashboard-config-field input')?.value")).toBe('3001')
    })
    await cdp.evaluate("document.querySelector('.dashboard-settings-pane button[type=submit]').click()")
    await until(async () => {
      expect(await readFile(configFile, 'utf8')).toBe('export default { nested: { port: 3001 } }')
      expect(await runningDashboardInstance(port)).not.toBe(beforeConfigSave)
      expect(await cdp.evaluate("document.querySelector('[data-config-path]')?.textContent")).toBe(configHeading)
      expect(await cdp.evaluate("document.querySelector('.dashboard-config-field input')?.value")).toBe('3001')
      expect(await cdp.evaluate("document.querySelector('.dashboard-settings-pane [role=status]')?.textContent")).toContain('Saved config/editor-probe.ts')
    }, 35_000)
  }
  finally {
    try {
      await browser?.cdp.send('Browser.close').catch(() => {})
      await browser?.close()
    }
    finally {
      child?.kill('SIGTERM')
      await child?.exited
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 })
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }).catch((error: NodeJS.ErrnoException) => {
        if (process.platform !== 'win32' || !['EBUSY', 'EPERM'].includes(error.code ?? ''))
          throw error
      })
    }
  }
}, 105_000)
