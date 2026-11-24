import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startAppDevSession } from '../../actions/src/dev/app-session'

async function until(check: () => Promise<void>): Promise<void> {
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      await check()
      return
    }
    catch (error) {
      if (Date.now() > deadline)
        throw error
      await Bun.sleep(50)
    }
  }
}

test.skipIf(process.env.STACKS_BROWSER_TESTS !== '1')('STX keeps an open page and its edits across successive frontend worker swaps', async () => {
  const { launch } = await import('../../testing/src/browser')
  const root = await mkdtemp(join(tmpdir(), 'stacks-frontend-hmr-'))
  const profile = await mkdtemp(join(tmpdir(), 'stacks-frontend-hmr-chrome-'))
  const source = join(root, 'app/version.ts')
  const viewSource = join(root, 'resources/views/view-version.ts')
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = reservation.port!
  await reservation.stop(true)
  const url = 'http://127.0.0.1:' + port + '/'
  let session: ReturnType<typeof startAppDevSession> | undefined
  let browser: Awaited<ReturnType<typeof launch>> | undefined
  try {
    await Promise.all(['app', 'config', 'resources/views'].map(dir => mkdir(join(root, dir), { recursive: true })))
    await Promise.all([
      writeFile(join(root, 'package.json'), '{"name":"frontend-hmr-fixture"}'),
      writeFile(join(root, 'bunfig.toml'), 'preload = []\n'),
      writeFile(join(root, 'config/app.ts'), 'export default {}'),
      writeFile(source, 'export default "before"'),
      writeFile(viewSource, 'export default undefined'),
      writeFile(join(root, 'resources/views/index.stx'), `
<script server>
const appModuleUrl = ${JSON.stringify(pathToFileURL(source).href)}
const viewModuleUrl = ${JSON.stringify(pathToFileURL(viewSource).href)}
const version = (await import(viewModuleUrl)).default ?? (await import(appModuleUrl)).default
const worker = process.pid
</script>
<script client>
const count = state(0)
function increment() { count.update(value => value + 1) }
</script>
<template>
  <main>
    <p id="version">{{ version }}</p>
    <p id="worker">{{ worker }}</p>
    <button id="count" @click="increment" :text="count()"></button>
    <input id="draft">
    <div id="list" style="height:50px;overflow:auto"><p style="height:500px">Scrollable list</p></div>
  </main>
</template>
`),
    ])
    session = startAppDevSession({
      root,
      target: 'frontend',
      frontendPort: port,
      async waitForPort(privatePort, _timeout, signal) {
        while (!signal.aborted) {
          const result = await fetch('http://127.0.0.1:' + privatePort + '/', {
            headers: { connection: 'close' },
            signal: AbortSignal.any([signal, AbortSignal.timeout(2_000)]),
          }).catch(() => null)
          if (result?.ok)
            return true
          await Bun.sleep(50)
        }
        return false
      },
      reportError: console.error,
    })
    void session.finished.catch(() => {})
    await until(async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      expect(await response.text()).toContain('data-stacks-dev-page-state')
    })

    browser = await launch({ quietLiveReload: false, profile })
    const { cdp } = browser
    await cdp.send('Network.enable')
    let liveReloadConnected = false
    cdp.on('Network.responseReceived', ({ response }) => {
      if (response.url === url + '_stx/hmr')
        liveReloadConnected = true
    })
    await cdp.send('Page.navigate', { url })
    await until(async () => {
      expect(liveReloadConnected).toBe(true)
      expect(await cdp.evaluate("document.querySelector('#count')?.textContent")).toBe('0')
    })
    await cdp.evaluate(`
      window.devStateProbe = 'same document'
      document.querySelector('#count').click()
      const draft = document.querySelector('#draft')
      draft.value = 'unsaved text'
      draft.focus()
      draft.setSelectionRange(2, 7)
      document.querySelector('#list').scrollTop = 55
    `)
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('#count')?.textContent")).toBe('1')
    })
    let pid = await cdp.evaluate<string>("document.querySelector('#worker').textContent")

    for (const [file, version] of [[source, 'first edit'], [viewSource, 'second edit']] as const) {
      await writeFile(file, 'export default ' + JSON.stringify(version))
      await until(async () => {
        expect(await cdp.evaluate("document.querySelector('#version')?.textContent")).toBe(version)
        expect(await cdp.evaluate("document.querySelector('#worker')?.textContent")).not.toBe(pid)
      })
      const live = await cdp.evaluate<{ pid: string }>(`({
        pid: document.querySelector('#worker').textContent,
        documentState: window.devStateProbe,
        count: document.querySelector('#count').textContent,
        draft: document.querySelector('#draft').value,
        focus: document.activeElement.id,
        selection: [document.activeElement.selectionStart, document.activeElement.selectionEnd],
        scroll: document.querySelector('#list').scrollTop,
      })`)
      expect(live.pid).not.toBe(pid)
      expect(live).toMatchObject({
        documentState: 'same document',
        count: '1',
        draft: 'unsaved text',
        focus: 'draft',
        selection: [2, 7],
        scroll: 55,
      })
      pid = live.pid
    }
    await cdp.evaluate("document.querySelector('#count').click()")
    await until(async () => {
      expect(await cdp.evaluate("document.querySelector('#count')?.textContent")).toBe('2')
    })
  }
  finally {
    try {
      await browser?.cdp.send('Browser.close').catch(() => {})
      await browser?.close()
    }
    finally {
      await session?.stop()
      await rm(root, { recursive: true, force: true })
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }).catch((error: NodeJS.ErrnoException) => {
        // The disposable profile can still be locked briefly by Windows.
        if (process.platform !== 'win32' || !['EBUSY', 'EPERM'].includes(error.code ?? ''))
          throw error
      })
    }
  }
}, 75_000)
