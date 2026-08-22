import type { CLI } from '@stacksjs/types'
import process from 'node:process'

// The iOS Simulator, as commands rather than as a paragraph in a chat log.
//
// Two commands, and the split is deliberate. `simulator:doctor` says whether a
// simulator can run *at all* and names the exact fix for each thing that is
// missing, because the failures here are environmental and none of them say
// what to do: `xcode-select` pointing at the command line tools reports a
// missing `xcodebuild`, and a machine with no runtime installed reports an
// empty device list rather than "download a runtime". `simulator:open` is the
// thing worth repeating: boot a phone, open a URL in Mobile Safari, and
// optionally take a picture of what it did.
//
// Checking a web app on a real phone is otherwise a page of `xcrun` that people
// paste from somewhere, get subtly wrong, and cannot repeat next month.
//
// The one command not here is the one that needs a password. `xcode-select -s`
// writes outside the home directory and prompts, so it is printed rather than
// run - a command that silently asks for a password from inside a build tool is
// a command people learn to type their password into without reading.
//
// Line comments rather than block comments inside function bodies, throughout:
// a block comment in a function body makes some lint configurations flag every
// parameter of the function it sits in.

// Where a full Xcode lives, in the order to prefer them.
const XCODE_PATHS = [
  '/Applications/Xcode.app/Contents/Developer',
  '/Applications/Xcode-beta.app/Contents/Developer',
]

interface SimulatorOpenOptions {
  device?: string
  screenshot?: string
  settle?: number | string
  fresh?: boolean
}

interface Ran {
  ok: boolean
  stdout: string
  stderr: string
}

async function run(command: string[], timeoutMs = 120_000): Promise<Ran> {
  const child = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' })

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((settle) => {
    timer = setTimeout(() => settle('timeout'), timeoutMs)
  })

  try {
    const finished = await Promise.race([child.exited, timeout])

    if (finished === 'timeout') {
      child.kill('SIGKILL')

      return { ok: false, stdout: '', stderr: `${command[0]} did not finish within ${Math.round(timeoutMs / 1000)}s` }
    }

    return {
      ok: finished === 0,
      stdout: await new Response(child.stdout).text(),
      stderr: await new Response(child.stderr).text(),
    }
  }
  finally {
    // Cleared rather than left to fire. `Promise.race` settles, but the timer
    // keeps the process alive for its whole duration - so a command that
    // finished in a second would hold the CLI open for two minutes.
    if (timer !== undefined)
      clearTimeout(timer)
  }
}

// macOS only, and said once rather than at every call site.
function onMac(): boolean {
  if (process.platform === 'darwin')
    return true

  console.error('  The iOS Simulator is macOS only. Nothing to check here.')

  return false
}

// What `xcode-select` currently points at, or null when it cannot be asked.
async function selectedDeveloperDir(): Promise<string | null> {
  const result = await run(['xcode-select', '-p'], 10_000)

  return result.ok ? result.stdout.trim() : null
}

// True when the selected directory is a full Xcode rather than the CLI tools.
function isFullXcode(path: string | null): boolean {
  return path != null && path.includes('.app/Contents/Developer')
}

// A full Xcode that is installed, for the message that names the fix.
async function installedXcode(): Promise<string | null> {
  for (const path of XCODE_PATHS) {
    if (await Bun.file(`${path}/usr/bin/simctl`).exists())
      return path
  }

  return null
}

interface Device {
  name: string
  udid: string
  state: string
  runtime: string
}

// Whether this is a page rather than some other scheme.
//
// Parsed rather than matched. A regular expression for this would contain
// an escaped double slash, and some lint parsers read those two characters as
// the start of a line comment - so every use of a variable after it in the same
// function disappears, and the rule that fires points nowhere near the cause.
// Parsing is also the better check: it rejects the shapes a pattern lets
// through.
function isWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol

    return protocol === 'http:' || protocol === 'https:'
  }
  catch {
    return false
  }
}

// Every bootable device, newest runtime first, phones before tablets.
async function devices(): Promise<Device[]> {
  const result = await run(['xcrun', 'simctl', 'list', 'devices', 'available', '--json'], 30_000)

  if (!result.ok)
    return []

  let parsed: { devices?: Record<string, Array<{ name: string, udid: string, state: string }>> }

  try {
    parsed = JSON.parse(result.stdout)
  }
  catch {
    return []
  }

  const found: Device[] = []

  for (const [runtime, list] of Object.entries(parsed.devices ?? {})) {
    for (const device of list)
      found.push({ ...device, runtime: runtime.split('.').pop() ?? runtime })
  }

  // A phone is what Mobile Safari means here, and the newest runtime is the one
  // a reader is most likely to be on.
  return found.sort((left, right) => {
    const phone = Number(right.name.startsWith('iPhone')) - Number(left.name.startsWith('iPhone'))

    return phone !== 0 ? phone : right.runtime.localeCompare(left.runtime)
  })
}

async function runtimes(): Promise<string[]> {
  const result = await run(['xcrun', 'simctl', 'list', 'runtimes', '--json'], 30_000)

  if (!result.ok)
    return []

  try {
    const parsed = JSON.parse(result.stdout) as { runtimes?: Array<{ name: string, isAvailable?: boolean }> }

    return (parsed.runtimes ?? []).filter(runtime => runtime.isAvailable !== false).map(runtime => runtime.name)
  }
  catch {
    return []
  }
}

export function simulator(buddy: CLI): void {
  buddy
    .command('simulator:doctor', 'Whether an iOS simulator can run here, and what to do when it cannot')
    .action(async () => {
      if (!onMac()) {
        process.exit(1)
        return
      }

      const selected = await selectedDeveloperDir()
      const full = isFullXcode(selected)
      const xcode = await installedXcode()

      console.error(`  developer directory   ${selected ?? 'could not be read'}`)

      if (!full) {
        console.error('')
        console.error('  The command line tools are selected, not Xcode, so there is no simulator.')

        if (xcode) {
          console.error('  Xcode is installed. Point at it - this needs your password, so run it yourself:')
          console.error('')
          console.error(`      sudo xcode-select -s ${xcode}`)
        }
        else {
          console.error('  No Xcode found in /Applications. Install it, then:')
          console.error('')
          console.error('      sudo xcode-select -s /Applications/Xcode.app/Contents/Developer')
        }

        console.error('')
        process.exit(1)
      }

      const available = await runtimes()
      console.error(`  runtimes              ${available.length > 0 ? available.join(', ') : 'none'}`)

      if (available.length === 0) {
        console.error('')
        console.error('  No iOS runtime is installed, so nothing can boot. Xcode ships without one:')
        console.error('')
        console.error('      xcodebuild -downloadPlatform iOS')
        console.error('')
        console.error('  It is several gigabytes. Check there is room for it first.')
        console.error('')
        process.exit(1)
      }

      const list = await devices()
      const booted = list.filter(device => device.state === 'Booted')

      console.error(`  devices               ${list.length} available, ${booted.length} booted`)

      if (booted.length > 0) {
        for (const device of booted)
          console.error(`    ${device.name} (${device.runtime})`)
      }

      console.error('')
      console.error('  Ready. `buddy simulator:open <url>` boots a phone and opens it in Mobile Safari.')
      console.error('')
    })

  buddy
    .command('simulator:open <url>', 'Open a URL in Mobile Safari on a simulator, booting one if needed')
    .option('--device <name>', 'Which device, by name. Defaults to the newest iPhone.', { default: '' })
    .option('--screenshot <path>', 'Save a picture of the result here', { default: '' })
    .option('--settle <seconds>', 'How long to let the page load before the screenshot', { default: 8 })
    .option('--fresh', 'Quit Mobile Safari first, so this is not the last page again', { default: false })
    .action(async (url: string, options: SimulatorOpenOptions) => {
      if (!onMac()) {
        process.exit(1)
        return
      }

      // Refused rather than passed to `simctl openurl`. `openurl` hands whatever
      // it is given to the system, and the system knows a great many schemes -
      // `prefs:`, `tel:`, and whatever else an app on the simulator has
      // registered. A build tool that opens arbitrary schemes on request is a
      // wider thing than the one being asked for.
      if (!isWebUrl(url)) {
        console.error('  Only http and https URLs. Anything else is a scheme, not a page.')
        process.exit(1)
        return
      }

      if (!isFullXcode(await selectedDeveloperDir())) {
        console.error('  No full Xcode selected. Run `buddy simulator:doctor` for the fix.')
        process.exit(1)
        return
      }

      const wanted = String(options.device ?? '')
      const list = await devices()
      const chosen = wanted
        ? list.find(device => device.name === wanted)
        : list.find(device => device.state === 'Booted') ?? list[0]

      if (!chosen) {
        console.error(wanted
          ? `  No device called ${wanted}. \`xcrun simctl list devices available\` says what there is.`
          : '  No devices available. Run `buddy simulator:doctor`.')
        process.exit(1)
        return
      }

      if (chosen.state !== 'Booted') {
        console.error(`  booting ${chosen.name}…`)
        const booted = await run(['xcrun', 'simctl', 'boot', chosen.udid], 180_000)

        // Already booted is not a failure, and it is what a second run says.
        if (!booted.ok && !booted.stderr.includes('current state: Booted')) {
          console.error(`  could not boot ${chosen.name}: ${booted.stderr.trim()}`)
          process.exit(1)
          return
        }

        // A device reports Booted long before it can open anything, and the
        // first boot of a fresh runtime is the slow one. Waiting here is why
        // `simulator:open` works on a machine that has never run a simulator.
        await run(['xcrun', 'simctl', 'bootstatus', chosen.udid], 180_000)
      }

      // Quit Safari first, when asked.
      //
      // `openurl` on a URL Safari already has open restores the page from its
      // back-forward cache - same scroll position, same DOM, none of the CSS or
      // script that changed since. Checking a fix that way photographs the bug
      // it was meant to fix and reports it as still there.
      if (options.fresh) {
        await run(['xcrun', 'simctl', 'terminate', chosen.udid, 'com.apple.mobilesafari'], 30_000)
        await Bun.sleep(1200)
      }

      const opened = await run(['xcrun', 'simctl', 'openurl', chosen.udid, url], 60_000)

      if (!opened.ok) {
        console.error(`  could not open the URL: ${opened.stderr.trim()}`)
        process.exit(1)
        return
      }

      console.error(`  opened on ${chosen.name} (${chosen.runtime})`)

      const shot = String(options.screenshot ?? '')

      if (shot) {
        const settle = Math.max(0, Number(options.settle ?? 8))

        // Waited out rather than polled: there is no way to ask Mobile Safari
        // whether it has finished, and a screenshot taken too early is a
        // picture of a blank page that looks exactly like the failure being
        // tested for.
        console.error(`  waiting ${settle}s for the page…`)
        await Bun.sleep(settle * 1000)

        const captured = await run(['xcrun', 'simctl', 'io', chosen.udid, 'screenshot', shot], 60_000)

        if (!captured.ok) {
          console.error(`  could not take a screenshot: ${captured.stderr.trim()}`)
          process.exit(1)
          return
        }

        console.error(`  screenshot ${shot}`)
      }
    })
}
