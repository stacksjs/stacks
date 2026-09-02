import type { CLI } from '@stacksjs/types'
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { intro, onUnknownSubcommand, outro, prompts } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { loadTsCloudConfig, loadTsCloudDeployApi, resolveProvider } from './deploy'
import { resolveSshTarget, sshStatePin, type SshTarget } from './deploy-ssh-target'
import {
  describeDisk,
  flashRefusalReason,
  parseDnsSdBrowse,
  parseOsCatalogue,
  resolveBootVolume,
  selectImage,
  type DiskInfo,
  type ServerImage,
  type ServerOsId,
} from './server-image'


/** Synchronous output: an async logger loses whatever precedes a process.exit. */
const log = {
  info: (...args: any[]) => console.log('\u2139', ...args),
  success: (...args: any[]) => console.log('\u2713', ...args),
  warn: (...args: any[]) => console.log('\u26A0', ...args),
  error: (...args: any[]) => console.error('\u2717', ...args),
}

/**
 * Getting a Linux box ready to be deployed to.
 *
 * These commands cover the part of the journey `buddy deploy` cannot: turning a
 * board with nothing on it into a host that answers SSH and runs what the
 * deploy expects. They are deliberately generic. A Raspberry Pi is the case
 * they were built for, but nothing here is Pi-specific beyond a default, so an
 * old laptop or a rented box works the same way.
 */

/** The official catalogue Raspberry Pi publishes for its own imager. */
const OS_CATALOGUE_URL = 'https://downloads.raspberrypi.com/os_list_imagingutility_v4.json'

/** Where downloaded images are kept between runs, so a retry does not refetch. */
function imageCacheDir(): string {
  return join(homedir(), '.cache', 'stacks', 'images')
}

/** Ask macOS about a disk, in the terms `flashRefusalReason` reads. */
async function readDiskInfo(device: string): Promise<DiskInfo | null> {
  const proc = Bun.spawn(['diskutil', 'info', '-plist', device], { stdout: 'pipe', stderr: 'pipe' })
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  if (code !== 0 || !out.trim())
    return null

  // The plist is small and regular, so the handful of keys the safety check
  // needs are read directly rather than pulling in a plist parser.
  const bool = (key: string): boolean | undefined => {
    const match = new RegExp(`<key>${key}</key>\\s*<(true|false)/>`).exec(out)
    return match ? match[1] === 'true' : undefined
  }
  const str = (key: string): string | undefined => {
    const match = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(out)
    return match?.[1]
  }
  const num = (key: string): number | undefined => {
    const match = new RegExp(`<key>${key}</key>\\s*<integer>(\\d+)</integer>`).exec(out)
    return match ? Number(match[1]) : undefined
  }

  return {
    DeviceIdentifier: str('DeviceIdentifier'),
    DeviceNode: str('DeviceNode'),
    MediaName: str('MediaName'),
    Size: num('Size'),
    WholeDisk: bool('WholeDisk'),
    Internal: bool('Internal'),
    Ejectable: bool('Ejectable'),
    Removable: bool('Removable'),
    RemovableMediaOrExternalDevice: bool('RemovableMediaOrExternalDevice'),
    SystemImage: bool('SystemImage'),
    BusProtocol: str('BusProtocol'),
  }
}

/** Every removable whole disk currently attached. */
async function listFlashableDisks(): Promise<DiskInfo[]> {
  const proc = Bun.spawn(['diskutil', 'list', '-plist'], { stdout: 'pipe', stderr: 'pipe' })
  const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  const whole = [...out.matchAll(/<string>(disk\d+)<\/string>/g)].map(match => match[1] as string)

  const found: DiskInfo[] = []
  for (const id of [...new Set(whole)]) {
    const info = await readDiskInfo(`/dev/${id}`)
    if (info && flashRefusalReason(info) === null)
      found.push(info)
  }
  return found
}

/** Fetch the catalogue and pick the requested image out of it. */
async function resolveImage(os: ServerOsId): Promise<ServerImage> {
  const response = await fetch(OS_CATALOGUE_URL)
  if (!response.ok)
    throw new Error(`Could not read the image catalogue (HTTP ${response.status}). Check the network and try again.`)

  return selectImage(parseOsCatalogue(await response.json()), os)
}

/** Download to the cache, resuming nothing but skipping a file already there. */
async function downloadImage(image: ServerImage): Promise<string> {
  const dir = imageCacheDir()
  mkdirSync(dir, { recursive: true })
  const target = join(dir, image.url.split('/').pop() || `${image.id}.img.xz`)

  if (existsSync(target) && image.downloadSize && statSync(target).size === image.downloadSize) {
    log.info(`Using the cached download at ${target}`)
    return target
  }

  const size = image.downloadSize ? ` (${(image.downloadSize / 1e9).toFixed(2)} GB)` : ''
  log.info(`Downloading ${image.name}${size}...`)
  const response = await fetch(image.url)
  if (!response.ok || !response.body)
    throw new Error(`Download failed (HTTP ${response.status}) for ${image.url}`)

  // Streamed rather than buffered: these images do not fit comfortably in
  // memory, and the decompressed form is several times larger again.
  const file = createWriteStream(`${target}.part`)
  await Bun.write(Bun.file(`${target}.part`), response)
  file.close()
  await Bun.$`mv ${`${target}.part`} ${target}`.quiet()
  return target
}

/** The decompressor to use, or an explanation of how to get one. */
async function resolveDecompressor(): Promise<string[]> {
  for (const candidate of ['xz', 'unxz']) {
    const which = Bun.spawnSync(['which', candidate])
    if (which.exitCode === 0)
      return [candidate, '-dc']
  }

  throw new Error(
    'No xz decompressor found, and the images are .img.xz.\n'
    + '  Install one with:  brew install xz\n'
    + '  Or flash the card with Raspberry Pi Imager, then run `buddy server:first-boot` against the mounted card.',
  )
}


/**
 * The ts-cloud SSH surface, or a clear reason it is unavailable.
 *
 * These commands need exports that only exist in a newer ts-cloud than an app
 * may have installed. Feature-detecting them turns "X is not a function" deep
 * inside a command into one sentence naming the upgrade, which is the same
 * approach `tsCloudPersistentStateSupport` takes for the deploy path.
 */
async function loadSshApi(): Promise<any> {
  const api = await loadTsCloudDeployApi() as any
  const missing = ['SshDriver', 'buildCloudInitFirstBoot', 'buildSshBootstrapScript', 'evaluatePreflight', 'formatPreflightFindings']
    .filter(name => typeof api[name] !== 'function')

  if (missing.length > 0) {
    log.error('This @stacksjs/ts-cloud does not support deploying to a host over SSH.')
    log.error(`Missing: ${missing.join(', ')}.`)
    log.info('Upgrade with `bun update @stacksjs/ts-cloud`, or point TS_CLOUD_MODULE at a build that has it.')
    process.exit(ExitCode.FatalError)
  }

  return api
}

/** The config this project deploys with, or a message about configuring one. */
async function loadSshProject(environment: string): Promise<{ config: any, target: SshTarget }> {
  const config = await loadTsCloudConfig(environment)
  if (!config) {
    log.error('No ts-cloud configuration found. Expected a `tsCloud` export from config/cloud.ts.')
    process.exit(ExitCode.FatalError)
  }

  const target = resolveSshTarget(config)
  if (!target) {
    log.error('No SSH host configured.')
    log.info("Add one to config/cloud.ts:  ssh: { hosts: [{ host: 'pi-stacks.local', user: 'pi' }] }")
    log.info('Or set TS_CLOUD_SSH_HOST (with TS_CLOUD_SSH_USER / TS_CLOUD_SSH_PORT / TS_CLOUD_SSH_KEY).')
    process.exit(ExitCode.FatalError)
  }

  if (resolveProvider(config) !== 'ssh')
    log.warn(`config/cloud.ts sets provider '${resolveProvider(config)}'. Set it to 'ssh' before \`buddy deploy\` will use this host.`)

  return { config, target }
}

/**
 * Hosts advertising SSH on the local network.
 *
 * Browsing is a passive listen with no fixed end, so it is stopped after a few
 * seconds. A board that has only just booted may not have announced itself yet,
 * which is why this supplements naming a host rather than replacing it.
 */
async function discoverHosts(seconds = 4): Promise<Array<{ name: string, hostname: string }>> {
  if (process.platform !== 'darwin')
    return []

  const proc = Bun.spawn(['dns-sd', '-B', '_ssh._tcp', 'local.'], { stdout: 'pipe', stderr: 'ignore' })
  const timer = setTimeout(() => proc.kill(), seconds * 1000)
  try {
    return parseDnsSdBrowse(await new Response(proc.stdout).text())
  }
  catch {
    return []
  }
  finally {
    clearTimeout(timer)
  }
}

/** Run the preflight and print it. Returns false when it found a blocker. */
async function reportPreflight(api: any, target: SshTarget, asJson: boolean): Promise<boolean> {
  const driver = new api.SshDriver({
    hosts: [{ host: target.host, user: target.user, port: target.port, privateKeyPath: target.identityFile }],
    hostKey: target.hostKey,
    profile: target.profile,
  })

  let facts: any
  let findings: any[]
  try {
    ({ facts, findings } = await driver.preflight(target.host))
  }
  catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const unreachable = {
      code: 'ssh.unreachable',
      severity: 'error',
      message: `Could not reach ${target.user}@${target.host} over SSH.`,
      remediation: 'Check the board is powered on and on this network, that SSH is enabled, and that your key is authorised. A board that has just booted can take a minute to answer.',
      detail,
    }

    if (asJson) {
      console.log(JSON.stringify({ host: target.host, facts: null, findings: [unreachable] }, null, 2))
    }
    else {
      log.error(unreachable.message)
      log.info(unreachable.remediation)
      log.info(detail.split('\n').find(line => line.trim() && !line.startsWith('Remote SSH')) || detail)
    }
    return false
  }

  if (asJson) {
    console.log(JSON.stringify({ host: target.host, facts, findings }, null, 2))
  }
  else {
    const text = api.formatPreflightFindings(findings)
    if (text.trim())
      console.log(text)
    else
      log.success('No problems found.')
  }

  const failed = typeof api.preflightFailed === 'function'
    ? api.preflightFailed(findings)
    : findings.some((finding: any) => finding.severity === 'error')

  return !failed
}


/** Build the bootstrap, turning a config the host cannot run into one message. */
function buildBootstrapOrExit(api: any, config: any, environment: string, sudoUser?: string): string {
  const profile = config.ssh?.profile === 'generic' ? 'generic' : 'raspberry-pi'
  try {
    return api.buildSshBootstrapScript({ config, environment, profile, sudoUser, lan: config.ssh?.lan })
  }
  catch (err) {
    log.error(err instanceof Error ? err.message : String(err))
    log.info('Edit config/cloud.ts and run this again.')
    process.exit(ExitCode.FatalError)
  }
}

export function server(buddy: CLI): void {
  const descriptions = {
    flash: 'Write a Linux OS image to an SD card or USB disk',
    os: 'Which image to write: raspberry-pi-os-lite, raspberry-pi-os, ubuntu-24.04, ubuntu-26.04',
    device: 'The whole disk to write to, for example /dev/disk4',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('server:flash', descriptions.flash)
    .option('--os <name>', descriptions.os, { default: 'raspberry-pi-os-lite' })
    .option('--device <path>', descriptions.device, { default: undefined })
    .option('--list', 'List the disks that could be written to, and exit', { default: false })
    .option('--dry-run', 'Say what would happen without writing anything', { default: false })
    .option('--yes', 'Do not ask for confirmation before writing', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: { os: ServerOsId, device?: string, list?: boolean, dryRun?: boolean, yes?: boolean, verbose?: boolean }) => {
      const perf = await intro('buddy server:flash')

      if (process.platform !== 'darwin') {
        log.error('`buddy server:flash` currently supports macOS only.')
        log.info('On Linux, write the image with `dd`, then run `buddy server:first-boot` against the mounted boot partition.')
        process.exit(ExitCode.FatalError)
      }

      const disks = await listFlashableDisks()
      if (options.list) {
        if (disks.length === 0)
          log.info('No removable disks are attached.')
        for (const disk of disks)
          log.info(`  ${describeDisk(disk)}`)
        await outro('Exited', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      let image: ServerImage
      try {
        image = await resolveImage(options.os)
      }
      catch (err) {
        log.error(err instanceof Error ? err.message : String(err))
        process.exit(ExitCode.FatalError)
      }

      log.info(`Image: ${image.name} (${image.releaseDate ?? 'unknown date'})`)
      if (!image.supportsPi5)
        log.warn('This image is not listed as supporting the Raspberry Pi 5.')

      // Choosing the disk is the dangerous step, so it is never inferred: with
      // one candidate we still show it and ask, and with several we refuse to
      // guess. Writing to the wrong device erases it.
      let device = options.device
      if (!device) {
        if (disks.length === 0) {
          log.error('No removable disk is attached. Insert the card and try again, or pass --device.')
          process.exit(ExitCode.FatalError)
        }
        if (disks.length > 1) {
          log.error('Several removable disks are attached, so buddy will not pick one:')
          for (const disk of disks)
            log.error(`  ${describeDisk(disk)}`)
          log.info('Re-run with --device /dev/diskN naming the one you mean.')
          process.exit(ExitCode.FatalError)
        }
        device = disks[0]?.DeviceNode
      }

      const info = device ? await readDiskInfo(device) : null
      if (!info) {
        log.error(`Could not read ${device}. Check the device path with \`diskutil list\`.`)
        process.exit(ExitCode.FatalError)
      }

      const refusal = flashRefusalReason(info)
      if (refusal) {
        log.error(refusal)
        process.exit(ExitCode.FatalError)
      }

      let decompressor: string[]
      try {
        decompressor = await resolveDecompressor()
      }
      catch (err) {
        log.error(err instanceof Error ? err.message : String(err))
        process.exit(ExitCode.FatalError)
      }

      log.info(`Target: ${describeDisk(info)}`)
      if (options.dryRun) {
        log.info('Dry run: nothing was downloaded and nothing was written.')
        await outro('Exited', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (!options.yes) {
        const answer = await prompts.confirm({ message: `Erase ${describeDisk(info)} and write ${image.name}?`, initial: false })
        if (answer !== true) {
          log.info('Nothing was written.')
          process.exit(ExitCode.Success)
        }
      }

      let download: string
      try {
        download = await downloadImage(image)
      }
      catch (err) {
        log.error(err instanceof Error ? err.message : String(err))
        process.exit(ExitCode.FatalError)
      }

      // The raw device is an order of magnitude faster than the buffered one,
      // and the card must be unmounted before either will accept a write.
      const raw = (info.DeviceNode as string).replace('/dev/disk', '/dev/rdisk')
      log.info(`Unmounting ${info.DeviceNode}...`)
      await Bun.$`diskutil unmountDisk ${info.DeviceNode as string}`.nothrow()

      log.info('Writing the image. This needs your password, and takes a few minutes.')
      log.info(`  ${decompressor.join(' ')} ${download} | sudo dd of=${raw} bs=4m status=progress`)

      // Run through a shell so the pipe holds, and interactively so the sudo
      // prompt reaches the user. buddy never handles the password itself.
      const write = Bun.spawn([
        'sh',
        '-c',
        `${decompressor[0]} -dc ${JSON.stringify(download)} | sudo dd of=${JSON.stringify(raw)} bs=4m status=progress`,
      ], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })

      if (await write.exited !== 0) {
        log.error('Writing the image failed. The card is probably unusable until it is written again.')
        process.exit(ExitCode.FatalError)
      }

      await Bun.$`sync`.nothrow()
      log.success('Image written.')

      // The card remounts on its own once the write settles, and the boot
      // partition is where the next step writes its files.
      const boot = resolveBootVolume(image, existsSync)
      if (boot)
        log.info(`Boot partition mounted at ${boot}`)
      else
        log.info(`Re-insert the card if it does not mount, then look for /Volumes/${image.bootVolume}`)

      log.info('Next: `buddy server:first-boot --hostname <name> --user <name>` to configure the first boot.')
      await outro('Done', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('server:first-boot', 'Write the first-boot configuration onto a freshly flashed card')
    .option('--hostname <name>', 'The name the board answers to on the network', { default: 'pi-stacks' })
    .option('--user <name>', 'The login to create, which the deploy then uses', { default: 'pi' })
    .option('--ssh-key <path>', 'Public key to authorise', { default: undefined })
    .option('--os <name>', descriptions.os, { default: 'raspberry-pi-os-lite' })
    .option('--out <dir>', 'Write the files here instead of the mounted boot partition', { default: undefined })
    .option('--wifi-ssid <ssid>', 'Join this wireless network on first boot', { default: undefined })
    .option('--wifi-country <code>', 'Two-letter regulatory domain, required with wifi', { default: undefined })
    .option('--timezone <tz>', 'IANA timezone for the board', { default: undefined })
    .option('--env <name>', 'Environment whose configuration to bootstrap', { default: 'production' })
    .option('--force', 'Overwrite first-boot files already on the card', { default: false })
    .action(async (options: any) => {
      const perf = await intro('buddy server:first-boot')
      const api = await loadSshApi()
      const { config } = await loadSshProject(options.env)

      const keyPath = options.sshKey || join(homedir(), '.ssh', 'id_ed25519.pub')
      if (!existsSync(keyPath)) {
        log.error(`No public key at ${keyPath}.`)
        log.info('Generate one with:  ssh-keygen -t ed25519')
        log.info('Or point at an existing key with --ssh-key.')
        process.exit(ExitCode.FatalError)
      }

      // The passphrase never reaches argv, where it would sit in shell history
      // and in the process list for anyone on this machine to read.
      let wifi
      if (options.wifiSsid) {
        if (!options.wifiCountry) {
          log.error('--wifi-country is required with --wifi-ssid. It sets the radio regulatory domain.')
          process.exit(ExitCode.FatalError)
        }
        const passphrase = process.env.WIFI_PASSWORD
          || await prompts.password({ message: `Passphrase for ${options.wifiSsid}` })
        if (typeof passphrase !== 'string' || !passphrase) {
          log.error('No wireless passphrase given.')
          process.exit(ExitCode.FatalError)
        }
        wifi = { ssid: options.wifiSsid, passphrase, country: String(options.wifiCountry).toUpperCase() }
      }

      const bootstrap = buildBootstrapOrExit(api, config, options.env, options.user === 'root' ? undefined : options.user)

      const os = String(options.os).startsWith('ubuntu') ? 'ubuntu' : 'raspberry-pi-os'
      const bundle = api.buildCloudInitFirstBoot(
        {
          hostname: options.hostname,
          user: options.user,
          publicKey: (await Bun.file(keyPath).text()).trim(),
          timezone: options.timezone,
          wifi,
        },
        bootstrap,
        { os },
      )

      let destination = options.out
      if (!destination) {
        const image = await resolveImage(options.os).catch(() => null)
        destination = image ? resolveBootVolume(image, existsSync) : null
        if (!destination) {
          log.error('The card does not appear to be mounted.')
          log.info('Insert the freshly written card and try again, or pass --out <dir> to write the files elsewhere.')
          process.exit(ExitCode.FatalError)
        }
      }

      mkdirSync(destination, { recursive: true })
      for (const name of Object.keys(bundle.files)) {
        const path = join(destination, name)
        if (existsSync(path) && !options.force) {
          log.error(`${path} already exists. Re-run with --force to replace it.`)
          process.exit(ExitCode.FatalError)
        }
      }

      for (const [name, contents] of Object.entries(bundle.files as Record<string, string>)) {
        await Bun.write(join(destination, name), contents)
        log.success(`Wrote ${join(destination, name)}`)
      }

      if (bundle.instructions)
        console.log(`\n${bundle.instructions}`)

      log.info(`Next: eject the card, boot the board, then \`buddy server:doctor ${options.hostname}.local\``)
      await outro('Done', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('server:doctor [host]', 'Check that a host can run this application before deploying to it')
    .option('--env <name>', 'Environment whose configuration to check against', { default: 'production' })
    .option('--discover', 'Browse the local network for hosts advertising SSH', { default: false })
    .option('--json', 'Print the findings as JSON', { default: false })
    .action(async (host: string | undefined, options: any) => {
      const perf = options.json ? undefined : await intro('buddy server:doctor')
      const api = await loadSshApi()
      const { config, target } = await loadSshProject(options.env)

      let host_ = host
      if (!host_ && options.discover) {
        const found = await discoverHosts()
        if (found.length === 0)
          log.info('No hosts advertising SSH were found on this network.')
        for (const entry of found)
          log.info(`  ${entry.hostname}`)
        host_ = found[0]?.hostname
      }

      const checked: SshTarget = host_ ? { ...target, host: host_ } : target
      log.info(`Checking ${checked.user}@${checked.host}${checked.port === 22 ? '' : `:${checked.port}`}...`)

      const ok = await reportPreflight(api, checked, options.json === true)
      if (perf)
        await outro(ok ? 'Ready' : 'Not ready', { startTime: perf, useSeconds: true })
      process.exit(ok ? ExitCode.Success : ExitCode.FatalError)
    })

  buddy
    .command('server:setup [host]', 'Adopt a host: check it, then install what the deploy needs')
    .option('--env <name>', 'Environment whose configuration to bootstrap', { default: 'production' })
    .option('--discover', 'Browse the local network for hosts advertising SSH', { default: false })
    .option('--dry-run', 'Run the checks and stop before changing the host', { default: false })
    .action(async (host: string | undefined, options: any) => {
      const perf = await intro('buddy server:setup')
      const api = await loadSshApi()
      const { config, target } = await loadSshProject(options.env)

      let host_ = host
      if (!host_ && options.discover) {
        const found = await discoverHosts()
        for (const entry of found)
          log.info(`  ${entry.hostname}`)
        host_ = found[0]?.hostname
      }

      const adopted: SshTarget = host_ ? { ...target, host: host_ } : target
      log.info(`Adopting ${adopted.user}@${adopted.host}${adopted.port === 22 ? '' : `:${adopted.port}`}`)

      if (!await reportPreflight(api, adopted, false)) {
        log.error('The host is not ready. Nothing was changed on it.')
        process.exit(ExitCode.FatalError)
      }

      if (options.dryRun) {
        log.info('Dry run: the host passed its checks and was not modified.')
        await outro('Done', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      const driver = api.createCloudDriver({ config, provider: 'ssh' })
      if (!driver.provisionComputeInfrastructure) {
        log.error('This ts-cloud cannot bootstrap an SSH host (update @stacksjs/ts-cloud).')
        process.exit(ExitCode.FatalError)
      }

      // Bootstrapping is idempotent and marks itself done, so running this
      // against an already-prepared board is a no-op rather than a rebuild.
      // Fail on a config this host cannot run before touching it, with the
      // same message `server:first-boot` would have given.
      buildBootstrapOrExit(api, config, options.env, adopted.user === 'root' ? undefined : adopted.user)

      log.info('Installing the runtime, gateway and service units if they are missing...')
      let outputs: any
      try {
        outputs = await driver.provisionComputeInfrastructure({ config, environment: options.env })
      }
      catch (err) {
        log.error('Bootstrapping the host failed.')
        log.error(err instanceof Error ? err.message : String(err))
        process.exit(ExitCode.FatalError)
      }

      const stackName = config.project?.stackName || `${config.project?.slug || 'app'}-${options.env}`
      const dir = join(process.cwd(), 'storage', 'cloud', 'state')
      mkdirSync(dir, { recursive: true })
      await Bun.write(
        join(dir, `${stackName}.json`),
        `${JSON.stringify(sshStatePin({ stackName, target: adopted, deployStoragePath: outputs?.deployStoragePath }), null, 2)}\n`,
      )
      log.success(`Host adopted. Recorded at storage/cloud/state/${stackName}.json`)
      log.info('Next: `buddy deploy --prod`')
      await outro('Done', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('server:*', () => {
    onUnknownSubcommand(buddy, 'server')
  })
}
