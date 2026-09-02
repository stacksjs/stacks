/**
 * Choosing an operating system image, and choosing a disk to write it to.
 *
 * Everything here is pure so the dangerous part can be tested. `server:flash`
 * writes a raw image to a block device, and the difference between the right
 * device and the wrong one is the difference between a prepared SD card and an
 * erased laptop. The disk allowlist below is therefore written to refuse by
 * default and to say why, rather than to permit whatever looks plausible.
 */

/** The OS images `buddy server:flash` knows how to fetch. */
export type ServerOsId = 'raspberry-pi-os-lite' | 'raspberry-pi-os' | 'ubuntu-24.04' | 'ubuntu-26.04'

/** Which first-boot files an image reads, which decides what we generate. */
export type FirstBootFormat = 'cloudinit' | 'unsupported'

/** One image as the official index describes it. */
export interface ServerImage {
  id: ServerOsId
  name: string
  url: string
  /** sha256 of the decompressed image, which is what we can verify after writing. */
  extractSha256?: string
  /** sha256 of the download itself; absent for the Raspberry Pi images. */
  downloadSha256?: string
  downloadSize?: number
  extractSize?: number
  releaseDate?: string
  /** The boot-partition volume name macOS mounts for this image. */
  bootVolume: string
  firstBoot: FirstBootFormat
  supportsPi5: boolean
}

/** The index entry names, as they appear in the official imager catalogue. */
const CATALOGUE_NAMES: Record<ServerOsId, { match: RegExp, bootVolume: string }> = {
  'raspberry-pi-os-lite': { match: /^Raspberry Pi OS Lite \(64-bit\)$/, bootVolume: 'bootfs' },
  'raspberry-pi-os': { match: /^Raspberry Pi OS \(64-bit\)$/, bootVolume: 'bootfs' },
  'ubuntu-24.04': { match: /^Ubuntu Server 24\.04.*\(64-bit\)$/, bootVolume: 'system-boot' },
  'ubuntu-26.04': { match: /^Ubuntu Server 26\.04.*\(64-bit\)$/, bootVolume: 'system-boot' },
}

/**
 * The catalogue Raspberry Pi publishes for its own imager.
 *
 * Read rather than hardcoded because image URLs carry a build date, so a
 * pinned link goes stale within months and a stale Pi OS image predates
 * cloud-init entirely. `init_format` is the field that says which first-boot
 * system the image runs, and it is the only thing that decides whether the
 * files we generate will be read at all.
 */
export function parseOsCatalogue(raw: unknown): ServerImage[] {
  const found: ServerImage[] = []
  const seen = new Set<ServerOsId>()

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (!node || typeof node !== 'object')
      return

    const entry = node as Record<string, unknown>
    const name = typeof entry.name === 'string' ? entry.name : ''
    const url = typeof entry.url === 'string' ? entry.url : ''

    if (name && url) {
      for (const [id, spec] of Object.entries(CATALOGUE_NAMES) as Array<[ServerOsId, { match: RegExp, bootVolume: string }]>) {
        if (seen.has(id) || !spec.match.test(name))
          continue

        const devices = Array.isArray(entry.devices) ? entry.devices.map(String) : []
        const init = typeof entry.init_format === 'string' ? entry.init_format : ''
        seen.add(id)
        found.push({
          id,
          name,
          url,
          extractSha256: typeof entry.extract_sha256 === 'string' ? entry.extract_sha256 : undefined,
          downloadSha256: typeof entry.image_download_sha256 === 'string' ? entry.image_download_sha256 : undefined,
          downloadSize: typeof entry.image_download_size === 'number' ? entry.image_download_size : undefined,
          extractSize: typeof entry.extract_size === 'number' ? entry.extract_size : undefined,
          releaseDate: typeof entry.release_date === 'string' ? entry.release_date : undefined,
          bootVolume: spec.bootVolume,
          // 'cloudinit' on Ubuntu, 'cloudinit-rpi' on Raspberry Pi OS Trixie.
          // Anything else is an image whose first-boot files we cannot write.
          firstBoot: init.startsWith('cloudinit') ? 'cloudinit' : 'unsupported',
          supportsPi5: devices.includes('pi5-64bit'),
        })
      }
    }

    for (const value of Object.values(entry)) visit(value)
  }

  visit(raw)
  return found
}

/** Pick one image out of the catalogue, or say what is on offer. */
export function selectImage(images: ServerImage[], id: ServerOsId): ServerImage {
  const image = images.find(candidate => candidate.id === id)
  if (!image)
    throw new Error(`No image named '${id}' in the catalogue. Found: ${images.map(i => i.id).join(', ') || 'nothing'}.`)

  if (image.firstBoot !== 'cloudinit') {
    throw new Error(
      `'${image.name}' does not boot with cloud-init, so buddy cannot write its first-boot configuration. `
      + `Pick a current image, or flash it with Raspberry Pi Imager and run \`buddy server:setup\` afterwards.`,
    )
  }

  return image
}

/** What `diskutil info -plist` says about a candidate device. */
export interface DiskInfo {
  DeviceIdentifier?: string
  DeviceNode?: string
  MediaName?: string
  Size?: number
  WholeDisk?: boolean
  Internal?: boolean
  Ejectable?: boolean
  Removable?: boolean
  RemovableMediaOrExternalDevice?: boolean
  SystemImage?: boolean
  BusProtocol?: string
}

/**
 * Whether a disk may be written to, and if not, why not.
 *
 * Every condition is a refusal rather than a permission: a disk qualifies only
 * by being a whole device, not internal, not the running system, and removable
 * or external by at least one of the three ways macOS reports that. A partition
 * is refused outright, because writing an image to one leaves an unbootable
 * card and may well have been a mistyped whole-disk name.
 */
export function flashRefusalReason(info: DiskInfo): string | null {
  const id = info.DeviceIdentifier || info.DeviceNode || 'that disk'

  if (info.WholeDisk !== true)
    return `${id} is a partition, not a whole disk. Pass the whole device, for example /dev/disk4 rather than /dev/disk4s1.`

  if (info.SystemImage === true)
    return `${id} holds the running macOS system.`

  if (info.Internal === true)
    return `${id} is an internal disk (${info.MediaName || 'unknown model'}).`

  const removable = info.Removable === true || info.Ejectable === true || info.RemovableMediaOrExternalDevice === true
  if (!removable)
    return `${id} is neither removable nor external, so buddy will not write to it.`

  return null
}

/** A one-line description of a disk, for the confirmation prompt. */
export function describeDisk(info: DiskInfo): string {
  const gb = typeof info.Size === 'number' ? `${(info.Size / 1e9).toFixed(1)} GB` : 'unknown size'
  return `${info.DeviceNode || info.DeviceIdentifier} - ${info.MediaName || 'unknown model'}, ${gb}${info.BusProtocol ? `, ${info.BusProtocol}` : ''}`
}

/**
 * Where the boot partition of a freshly written card is mounted.
 *
 * macOS mounts it by volume name, and the two OS families use different ones.
 * A card that was just written is often not mounted yet, so a miss here is
 * normal and the caller waits or takes an explicit path.
 */
export function resolveBootVolume(
  image: Pick<ServerImage, 'bootVolume'>,
  exists: (path: string) => boolean,
): string | null {
  const primary = `/Volumes/${image.bootVolume}`
  if (exists(primary))
    return primary

  // Written more than once without ejecting, macOS appends a counter.
  for (let n = 1; n <= 5; n++) {
    const candidate = `${primary} ${n}`
    if (exists(candidate))
      return candidate
  }

  return null
}

/** One host advertising SSH over mDNS. */
export interface DiscoveredHost {
  name: string
  hostname: string
}

/**
 * Hosts from `dns-sd -B _ssh._tcp local.` output.
 *
 * The tool prints a running log rather than a list, one line per event, and
 * emits `Rmv` when a host goes away. Removals have to be honoured or a board
 * that just rebooted is offered as if it were still answering.
 */
export function parseDnsSdBrowse(output: string): DiscoveredHost[] {
  const live = new Map<string, DiscoveredHost>()

  for (const line of output.split('\n')) {
    const match = /\b(Add|Rmv)\b.*?\b_ssh\._tcp\.?\s+(.+?)\s*$/.exec(line)
    if (!match)
      continue

    const [, action, rawName] = match
    const name = (rawName ?? '').replace(/\\032/g, ' ').trim()
    if (!name)
      continue

    if (action === 'Rmv')
      live.delete(name)
    else
      live.set(name, { name, hostname: `${name.replace(/\s+/g, '-')}.local` })
  }

  return [...live.values()].sort((a, b) => a.name.localeCompare(b.name))
}
