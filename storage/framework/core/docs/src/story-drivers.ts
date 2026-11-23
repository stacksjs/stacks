import type { Cdp, LaunchOptions } from '@stacksjs/testing/browser'
import type { StoryDriver } from './stories'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { click, launch, settle, waitFor } from '@stacksjs/testing/browser'
import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type BrowserFilm, openBrowserFilm, serveFilmStudio } from './browser-film'
import { captureBrowser } from './capture-browser'
import { captureMaskCss } from './capture-masks'

export interface BrowserStoryContext {
  cdp: Cdp
  goto: (path: string, options?: { expectedStatus?: number }) => Promise<void>
  click: (target: string | { selector: string, text?: string }) => Promise<void>
  type: (selector: string, value: string) => Promise<void>
  expectText: (selector: string, text: string) => Promise<void>
}
export interface BrowserStoryOptions {
  baseUrl: string
  viewport?: LaunchOptions['viewport']
  chromePath?: string
  headless?: boolean
  /** Optional FFmpeg executable for streaming frames directly to H.264 on constrained runners. */
  ffmpeg?: string
  /** Selector masks are applied before the first recorded frame, on every document. */
  masks?: string[]
  cursor?: { color?: string, size?: number, moveMs?: number, clickMs?: number }
  /** Configure browser-level state such as HTTP authentication before the first request. */
  beforeNavigate?: (cdp: Cdp) => Promise<void>
  /** Prepare the application session after its first document loads, before capture. */
  prepare?: (context: BrowserStoryContext) => Promise<void>
  failOnBrowserErrors?: boolean
}
function finite(value: number, min: number, max: number, label: string) { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}`) }
function origin(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Story baseUrl must be HTTP(S), without credentials')
  return url
}
async function command(args: string[], signal?: AbortSignal, timeoutMs = 30000): Promise<Uint8Array> {
  signal?.throwIfAborted()
  const child = spawnOwnedProcess(args)
  let timedOut = false
  const abort = () => { void child.stop().catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => { timedOut = true; abort() }, timeoutMs)
  try {
    const [exit, stdout] = await Promise.all([child.exited, new Response(child.stdout).bytes(), new Response(child.stderr).text()])
    signal?.throwIfAborted()
    if (timedOut) throw new Error('Story tool timed out')
    if (exit.code !== 0) throw new Error(`Story tool failed: ${args[0]}`)
    return stdout
  }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); await child.stop() }
}

async function openStreamedFilm(executable: string, fps: number, path: string) {
  const encoder = spawnOwnedProcess([
    executable, '-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-threads', '2',
    '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0',
    '-an', '-filter_threads', '1', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path,
  ], { stdin: 'pipe' })
  const error = new Response(encoder.stderr).text()
  const output = new Response(encoder.stdout).arrayBuffer()
  try {
    await encoder.started
    const input = encoder.stdin
    if (!input) throw new Error('Story encoder has no input stream')
    return {
      async add(picture: Uint8Array, frames: number) {
        for (let index = 0; index < frames; index++) {
          input.write(picture)
          await input.flush()
        }
      },
      async finish() {
        await input.end()
        const [exit, diagnostic] = await Promise.all([encoder.exited, error, output])
        if (exit.code !== 0) throw new Error(`Story encoder failed: ${diagnostic.trim() || exit.signal || exit.code}`)
      },
      async close() { await encoder.stop() },
    }
  }
  catch (error) { await encoder.stop(); throw error }
}

/** Chrome actions reuse the guarded testing click and dispatch real mouse movement. */
export function browserStory(options: BrowserStoryOptions): StoryDriver<BrowserStoryContext> {
  const base = origin(options.baseUrl)
  const cursor = { color: '#2563eb', size: 18, moveMs: 450, clickMs: 400, ...options.cursor }
  if (!/^#[0-9a-f]{6}$/i.test(cursor.color)) throw new Error('Cursor color must be a six-digit hex color')
  finite(cursor.size, 6, 80, 'cursor size'); finite(cursor.moveMs, 0, 5000, 'cursor movement'); finite(cursor.clickMs, 100, 5000, 'click feedback')
  return { platform: 'browser', fingerprint: options, async open({ videoPath, fps, signal }) {
    const browser = await launch({ viewport: options.viewport, chromePath: options.chromePath, headless: options.headless })
    const { cdp } = browser
    // The default encodes through a second page of the same browser.
    let studio: Awaited<ReturnType<typeof launch>> | undefined
    let room: ReturnType<typeof serveFilmStudio> | undefined
    let film: BrowserFilm | undefined
    let streamedFilm: Awaited<ReturnType<typeof openStreamedFilm>> | undefined
    let done = false
    let pumping: Promise<void> | undefined
    let captureError: unknown
    let latest: Uint8Array | undefined
    let off: (() => void) | undefined
    const documents = new Map<string, { status: number }>()
    const offDocuments = cdp.on('Network.responseReceived', response => { if (response.type === 'Document') documents.set(response.frameId, { status: response.response.status }) })
    // A call into a page that is closing may never settle. Everything that
    // waits on the encoder also waits on this, so shutdown cannot hang.
    let release!: () => void
    const released = new Promise<void>((resolve) => { release = resolve })
    const closeEncoder = async () => {
      release()
      room?.stop()
      room = undefined
      const open = studio
      const stream = streamedFilm
      studio = undefined
      streamedFilm = undefined
      await Promise.allSettled([Promise.race([open?.close(), Bun.sleep(5000)]), stream?.close()])
    }
    const abort = () => { done = true; void closeEncoder(); void browser.close().catch(() => {}) }
    signal.addEventListener('abort', abort, { once: true })
    try {
      signal.throwIfAborted()
      const name = `stacks-story-${randomUUID()}`
      const maskCss = captureMaskCss(options.masks ?? [])
      // A closed shadow root prevents page CSS from changing the pointer; the
      // host never accepts input. Masks exist before app scripts and first paint.
      const overlay = `(() => {
        const start = () => {
          const maskSheet = new CSSStyleSheet();
          maskSheet.replaceSync(${JSON.stringify(maskCss)});
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, maskSheet];
          const host = document.createElement('div'); host.id = ${JSON.stringify(name)};
          host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
          const shadow=host.attachShadow({mode:'closed'}); const dot=document.createElement('div');
          dot.style.cssText=${JSON.stringify(`position:absolute;width:${cursor.size}px;height:${cursor.size}px;border:2px solid white;border-radius:50%;background:${cursor.color};box-shadow:0 1px 4px #0008;left:24px;top:24px;transform:translate(-50%,-50%);pointer-events:none;`)};
          shadow.append(dot); document.documentElement.append(host);
          addEventListener('mousemove', event => {dot.style.left=event.clientX+'px';dot.style.top=event.clientY+'px'},true);
          addEventListener('pointerdown', event => {dot.style.left=event.clientX+'px';dot.style.top=event.clientY+'px';const pulse=document.createElement('div');pulse.style.cssText='position:absolute;left:'+event.clientX+'px;top:'+event.clientY+'px;width:12px;height:12px;border:4px solid ${cursor.color};border-radius:50%;transform:translate(-50%,-50%);';shadow.append(pulse);pulse.animate([{opacity:1,width:'12px',height:'12px'},{opacity:0,width:'70px',height:'70px'}],{duration:${cursor.clickMs}}).finished.then(()=>pulse.remove())},true);
        }; if(document.documentElement) start(); else new MutationObserver((_,observer)=>{if(document.documentElement){observer.disconnect();start()}}).observe(document,{childList:true});
      })()`
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: overlay })
      let position = { x: 24, y: 24 }
      const context: BrowserStoryContext = {
        cdp,
        async goto(path, settings = {}) {
          const url = new URL(path, base)
          if (url.origin !== base.origin || url.username || url.password) throw new Error('Story navigation must stay on baseUrl origin')
          const expectedStatus = settings.expectedStatus ?? 200
          if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) throw new Error('Invalid expected document status')
          const navigation = await cdp.send('Page.navigate', { url: url.href })
          if (navigation.errorText || !await settle(cdp, { quietMs: 150, timeoutMs: 15000 })) throw new Error('Story page did not settle')
          if (documents.get(navigation.frameId)?.status !== expectedStatus) throw new Error('Unexpected story document HTTP status')
          if (new URL(await cdp.evaluate<string>('location.href')).origin !== base.origin) throw new Error('Story page redirected outside baseUrl origin')
        },
        async click(target) {
          signal.throwIfAborted()
          const selector = typeof target === 'string' ? target : target.selector
          const text = typeof target === 'string' ? undefined : target.text
          const point = await waitFor(async () => cdp.evaluate<{ x: number, y: number } | null>(`(() => {const all=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(el=>${text === undefined ? 'true' : `el.textContent.trim()===${JSON.stringify(text)}`});if(all.length!==1)return null;const el=all[0];el.scrollIntoView({block:'center',behavior:'instant'});const r=el.getBoundingClientRect();return r.width&&r.height?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`), 12000)
          const from = position
          const started = performance.now()
          do {
            signal.throwIfAborted()
            const progress = cursor.moveMs ? Math.min(1, (performance.now() - started) / cursor.moveMs) : 1
            position = { x: from.x + (point.x - from.x) * progress, y: from.y + (point.y - from.y) * progress }
            await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position })
            if (progress === 1) break
            await Bun.sleep(16)
          } while (true)
          await click(cdp, target)
          await Bun.sleep(cursor.clickMs)
        },
        async type(selector, value) { await context.click(selector); await cdp.send('Input.insertText', { text: value }) },
        async expectText(selector, text) { await waitFor(() => cdp.evaluate<boolean>(`document.querySelector(${JSON.stringify(selector)})?.textContent.includes(${JSON.stringify(text)}) ?? false`), 12000) },
      }
      await options.beforeNavigate?.(cdp)
      signal.throwIfAborted()
      await context.goto(base.href)
      if (options.prepare) await options.prepare(context)
      latest = Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 })).data, 'base64')
      off = cdp.on('Page.screencastFrame', frame => {
        latest = Buffer.from(frame.data, 'base64')
        void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(error => { captureError = error })
      })
      if (options.ffmpeg) streamedFilm = await openStreamedFilm(options.ffmpeg, fps, videoPath)
      else {
        room = serveFilmStudio()
        studio = await launch({ viewport: { width: 320, height: 240 }, chromePath: options.chromePath, headless: options.headless })
        const studioPage = studio.cdp
        await studioPage.send('Page.navigate', { url: room.url })
        await waitFor(() => studioPage.evaluate<boolean>('document.readyState === "complete"'), 15000)
        film = await openBrowserFilm(script => studioPage.evaluate(script), { fps })
      }
      signal.throwIfAborted()
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 })
      const started = performance.now()
      pumping = (async () => {
        let frames = 0
        let sent: Uint8Array | undefined
        while (!done) {
          signal.throwIfAborted()
          if (captureError) throw captureError
          const wanted = Math.floor((performance.now() - started) / 1000 * fps) + 1
          if (wanted - frames > fps * 10) throw new Error('Story encoder cannot keep up with the recording')
          if (wanted > frames) {
            // The picture travels to the encoder only when the display changed;
            // an idle screen repeats the frame it already has.
            const picture = latest
            const count = wanted - frames
            const encode = streamedFilm ? streamedFilm.add(picture!, count) : film!.add(picture === sent ? undefined : picture, count)
            await Promise.race([encode, released])
            sent = picture
            frames = wanted
          }
          await Bun.sleep(Math.max(1, 1000 / fps / 2))
        }
      })().catch(error => { captureError = error })
      let finished: Promise<void> | undefined
      const finish = () => finished ??= (async () => {
        done = true
        const stream = streamedFilm
        let timedOut = false
        const deadline = setTimeout(() => { timedOut = true; void closeEncoder() }, 60000)
        try {
          await pumping
          await cdp.send('Page.stopScreencast')
          off?.()
          if (captureError) throw new Error('Story video capture failed', { cause: captureError })
          const write = stream ? stream.finish() : film!.finish().then(bytes => Bun.write(videoPath, bytes))
          try { await Promise.race([write, released.then(() => { throw new Error('The story encoder closed') })]) }
          catch (error) { throw new Error(timedOut ? 'Story video finalization timed out' : 'Story video capture failed', { cause: error }) }
          if (options.failOnBrowserErrors !== false && cdp.errors.length) throw new Error('Browser story produced console or network errors')
        }
        finally { clearTimeout(deadline); await closeEncoder() }
      })()
      return { context, screenshot: async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'), finish, async close() { done = true; off?.(); offDocuments(); signal.removeEventListener('abort', abort); try { await closeEncoder(); await pumping } finally { await browser.close() } } }
    }
    catch (error) {
      done = true; off?.(); offDocuments(); signal.removeEventListener('abort', abort)
      try { await closeEncoder(); await pumping } finally { await browser.close() }
      throw error
    }
  } }
}

export interface NativeStoryInput {
  /** Coordinates are display pixels, including system bars. Resolve target bounds in your existing native driver. */
  tap: (x: number, y: number) => Promise<void>
  swipe?: (from: { x: number, y: number }, to: { x: number, y: number }, durationMs: number) => Promise<void>
  type?: (text: string) => Promise<void>
}
export interface NativeStoryContext {
  tap: NativeStoryInput['tap']
  swipe: NonNullable<NativeStoryInput['swipe']>
  type: NonNullable<NativeStoryInput['type']>
}
export interface NativeStoryOptions {
  platform: 'ios' | 'android'
  /** Explicit booted simulator UUID or emulator-N serial. Never defaults to another user's device. */
  device: string
  /** Existing XCTest/Appium driver. Required on iOS; Android defaults to adb input. */
  input?: NativeStoryInput
  adb?: string
  xcrun?: string
  /** Set to false only when interaction indicators are supplied by the native driver. */
  tapFeedback?: boolean
  tapColor?: string
  tapMs?: number
  tapSize?: number
}

/** Record the OS display while reusing a native test driver's actual input actions. */
export function nativeStory(options: NativeStoryOptions): StoryDriver<NativeStoryContext> {
  const ios = options.platform === 'ios'
  if (ios ? !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(options.device) : !/^emulator-\d+$/.test(options.device)) throw new Error('Native stories require an explicit simulator UUID or emulator serial')
  if (ios && !options.input) throw new Error('iOS stories require an XCTest/Appium input adapter')
  const color = options.tapColor ?? '#2563eb'
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Tap color must be a six-digit hex color')
  finite(options.tapMs ?? 450, 100, 5000, 'tap feedback')
  const tapSize = options.tapSize ?? 72
  finite(tapSize, 12, 240, 'tap indicator size')
  return { platform: options.platform, fingerprint: options, async open({ videoPath, fps, signal }) {
    const rawPath = join(dirname(videoPath), 'native-raw.mp4')
    const adb = options.adb ?? 'adb'
    const xcrun = options.xcrun ?? 'xcrun'
    const androidFile = `/sdcard/stacks-story-${randomUUID()}.mp4`
    let stop: (() => Promise<void>) | undefined
    let recorder: ReturnType<typeof spawnOwnedProcess> | undefined
    let recorderPid: number | undefined
    let start = 0
    const taps: { x: number, y: number, start: number, end: number }[] = []
    const input: NativeStoryInput = options.input ?? {
      async tap(x, y) { await command([adb, '-s', options.device, 'shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))], signal) },
      async swipe(from, to, ms) { await command([adb, '-s', options.device, 'shell', 'input', 'swipe', String(Math.round(from.x)), String(Math.round(from.y)), String(Math.round(to.x)), String(Math.round(to.y)), String(Math.round(ms))], signal) },
      async type(value) {
        // adb shell input text is a shell argument protocol, not arbitrary Unicode.
        if (!/^[a-z0-9@._+ -]*$/i.test(value)) throw new Error('Use a native input adapter for Unicode or shell-sensitive text')
        await command([adb, '-s', options.device, 'shell', 'input', 'text', value.replaceAll(' ', '%s')], signal)
      },
    }
    const coordinate = (x: number, y: number) => { finite(x, 0, 16384, 'tap x'); finite(y, 0, 16384, 'tap y') }
    try {
      signal.throwIfAborted()
      if (ios) {
        const { recordIosSimulatorVideo } = await import('craft-native/testing')
        const recording = await recordIosSimulatorVideo({ device: options.device, path: rawPath, xcrun })
        stop = recording.stop
      }
      else {
        const state = new TextDecoder().decode(await command([adb, '-s', options.device, 'get-state'], signal)).trim()
        if (state !== 'device') throw new Error('Android emulator is unavailable')
        // The remote shell reports the PID of only this screenrecord. Never use
        // pkill/killall, which could stop another workflow's recording.
        recorder = spawnOwnedProcess([adb, '-s', options.device, 'shell', `screenrecord --time-limit 180 ${androidFile} & recorder=$!; trap 'kill -2 "$recorder" 2>/dev/null; wait "$recorder"; exit' HUP INT TERM; echo STACKS_RECORDER:$recorder; wait "$recorder"; result=$?; trap - HUP INT TERM; exit "$result"`])
        await recorder.started
        const reader = recorder.stdout!.getReader()
        let output = ''
        const deadline = setTimeout(() => { void recorder!.stop() }, 15000)
        try {
          while (!recorderPid) {
            const chunk = await reader.read()
            if (chunk.done) throw new Error('Android recorder stopped before startup')
            output += new TextDecoder().decode(chunk.value)
            const match = /STACKS_RECORDER:(\d+)/.exec(output)
            if (match) recorderPid = Number(match[1])
            if (output.length > 4096) throw new Error('Invalid Android recorder startup')
          }
        }
        finally { clearTimeout(deadline) }
        void (async () => { while (!(await reader.read()).done) {} })().catch(() => {})
        void new Response(recorder.stderr).text()
        const signalRecorder = async () => {
          // Check the unique recording filename before signalling a remote PID.
          // Android may have already stopped it at the platform's 180s limit.
          await command([adb, '-s', options.device, 'shell', `case "$(cat /proc/${recorderPid}/cmdline 2>/dev/null)" in *${androidFile}*) kill -2 ${recorderPid};; *) exit 3;; esac`])
        }
        await command([adb, '-s', options.device, 'shell', 'kill', '-0', String(recorderPid)], signal)
        stop = async () => {
          await signalRecorder()
          const timeout = setTimeout(() => { void recorder!.stop() }, 15000)
          try { await recorder!.exited } finally { clearTimeout(timeout) }
          await command([adb, '-s', options.device, 'pull', androidFile, rawPath])
        }
        // A PID acknowledges process startup, not display capture. Wait until
        // the muxer has written sample data beyond the MP4 header before any
        // scene can run, so encoder startup cannot cut the first scene short.
        await command([adb, '-s', options.device, 'shell', `attempt=0; while [ "$attempt" -lt 300 ]; do size=$(stat -c %s ${androidFile} 2>/dev/null); if [ "\${size:-0}" -gt 64 ]; then exit 0; fi; kill -0 ${recorderPid} 2>/dev/null || exit 1; attempt=$((attempt+1)); sleep 0.05; done; exit 2`], signal, 20000)
      }
      start = performance.now()
      const context: NativeStoryContext = {
        async tap(x, y) {
          signal.throwIfAborted(); coordinate(x, y)
          const tap = { x, y, start: (performance.now() - start) / 1000, end: 0 }
          taps.push(tap)
          try { await input.tap(x, y) }
          finally { tap.end = (performance.now() - start) / 1000 + (options.tapMs ?? 450) / 1000 }
        },
        async swipe(from, to, ms) { signal.throwIfAborted(); coordinate(from.x, from.y); coordinate(to.x, to.y); finite(ms, 1, 10000, 'swipe duration'); if (!input.swipe) throw new Error('Native driver does not support swipes'); await input.swipe(from, to, ms) },
        async type(value) { signal.throwIfAborted(); if (!input.type) throw new Error('Native driver does not support typing'); await input.type(value) },
      }
      let finished: Promise<void> | undefined
      const finish = () => finished ??= (async () => {
        await stop!()
        // The device's recording is re-timed and marked by a browser and
        // written by ts-videos: system WebKit on a Mac, Chrome elsewhere.
        const browser = captureBrowser(process.platform === 'darwin' ? 'webkit' : 'chrome')
        const room = serveFilmStudio({ '/raw.mp4': rawPath })
        let view: Bun.WebView | undefined
        try {
          view = await browser.view(320, 240)
          const filmView = view
          await filmView.navigate(room.url)
          const film = await openBrowserFilm(script => filmView.evaluate(script), { fps })
          await film.addVideo('/raw.mp4', options.tapFeedback === false ? [] : taps.map(tap => ({ x: tap.x, y: tap.y, size: tapSize, color, start: tap.start, end: tap.end })))
          await Bun.write(videoPath, await film.finish())
        }
        finally {
          room.stop()
          try { view?.close() }
          finally { await browser.close() }
        }
        await rm(rawPath)
      })()
      return {
        context,
        async screenshot() {
          signal.throwIfAborted()
          if (!ios) return command([adb, '-s', options.device, 'exec-out', 'screencap', '-p'], signal)
          const path = join(dirname(videoPath), `screenshot-${randomUUID()}.png`)
          try { await command([xcrun, 'simctl', 'io', options.device, 'screenshot', path], signal); return await readFile(path) }
          finally { await rm(path, { force: true }) }
        },
        finish,
        async close() {
          try { if (!finished) await stop?.() }
          finally {
            await recorder?.stop()
            if (!ios) await command([adb, '-s', options.device, 'shell', 'rm', '-f', androidFile])
          }
        },
      }
    }
    catch (error) {
      try { await stop?.() } finally { await recorder?.stop() }
      throw error
    }
  } }
}
