import { describe, expect, it } from 'bun:test'
import {
  describeDisk,
  flashRefusalReason,
  parseDnsSdBrowse,
  parseOsCatalogue,
  resolveBootVolume,
  selectImage,
} from '../src/commands/server-image'

/**
 * Picking an image and picking a disk.
 *
 * The disk half is the one that matters: `server:flash` writes a raw image to a
 * block device, so a helper that says yes too easily erases whatever was there.
 * These cases are taken from what `diskutil info -plist` actually reports on
 * this machine, including the internal system disk, which must always be
 * refused and must say which reason applied.
 */

// Trimmed from https://downloads.raspberrypi.com/os_list_imagingutility_v4.json,
// keeping the nesting so the walker is exercised rather than a flat list.
const catalogue = {
  os_list: [
    {
      name: 'Raspberry Pi OS (other)',
      subitems: [
        {
          name: 'Raspberry Pi OS Lite (64-bit)',
          url: 'https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-06-19/2026-06-18-raspios-trixie-arm64-lite.img.xz',
          extract_sha256: 'e235fd24fc5f039c08daba7d3abc04aecc7313f979d16d2a3fdad29dd44c33a9',
          image_download_size: 524875608,
          extract_size: 2977955840,
          release_date: '2026-06-18',
          devices: ['pi5-64bit', 'pi4-64bit', 'pi3-64bit'],
          init_format: 'cloudinit-rpi',
        },
      ],
    },
    {
      name: 'Other general-purpose OS',
      subitems: [
        {
          name: 'Ubuntu Server 24.04.4 LTS (64-bit)',
          url: 'http://cdimage.ubuntu.com/releases/noble/release/ubuntu-24.04.4-preinstalled-server-arm64+raspi.img.xz',
          image_download_sha256: '790652faeb4f61ce7bb12f5cb61734595c61d3cd882915b8b5f9918106c80d37',
          extract_sha256: '3a19cadaefbdbe7bbe7f51a9db74acd87cccbe57685fb398b563522e50eca1f0',
          devices: ['pi5-64bit'],
          init_format: 'cloudinit',
        },
        {
          name: 'Raspberry Pi OS Lite (32-bit)',
          url: 'https://example.invalid/legacy.img.xz',
          devices: ['pi3-32bit'],
          init_format: 'systemd',
        },
      ],
    },
  ],
}

describe('parseOsCatalogue', () => {
  const images = parseOsCatalogue(catalogue)

  it('finds the images we support wherever they are nested', () => {
    expect(images.map(image => image.id).sort()).toEqual(['raspberry-pi-os-lite', 'ubuntu-24.04'])
  })

  it('records which first-boot system each image runs', () => {
    // 'cloudinit-rpi' and 'cloudinit' both read user-data from the boot
    // partition, which is the only distinction that changes what we write.
    expect(images.every(image => image.firstBoot === 'cloudinit')).toBe(true)
  })

  it('knows the boot volume name each family mounts under', () => {
    expect(images.find(i => i.id === 'raspberry-pi-os-lite')?.bootVolume).toBe('bootfs')
    expect(images.find(i => i.id === 'ubuntu-24.04')?.bootVolume).toBe('system-boot')
  })

  it('carries the checksums and the Pi 5 support flag', () => {
    const lite = images.find(i => i.id === 'raspberry-pi-os-lite')!
    expect(lite.extractSha256).toBe('e235fd24fc5f039c08daba7d3abc04aecc7313f979d16d2a3fdad29dd44c33a9')
    // The Raspberry Pi images publish no checksum for the download itself.
    expect(lite.downloadSha256).toBeUndefined()
    expect(lite.supportsPi5).toBe(true)
  })

  it('returns nothing rather than throwing on a catalogue it cannot read', () => {
    expect(parseOsCatalogue({})).toEqual([])
    expect(parseOsCatalogue(null)).toEqual([])
  })
})

describe('selectImage', () => {
  const images = parseOsCatalogue(catalogue)

  it('returns the requested image', () => {
    expect(selectImage(images, 'raspberry-pi-os-lite').name).toBe('Raspberry Pi OS Lite (64-bit)')
  })

  it('names what is available when the request cannot be met', () => {
    expect(() => selectImage(images, 'ubuntu-26.04')).toThrow(/ubuntu-24\.04/)
  })

  it('refuses an image whose first boot we cannot configure', () => {
    const legacy = [{ ...images[0], firstBoot: 'unsupported' as const, name: 'Old Pi OS' }]
    expect(() => selectImage(legacy, 'raspberry-pi-os-lite')).toThrow(/does not boot with cloud-init/)
  })
})

describe('flashRefusalReason', () => {
  // The real reading for this machine's internal drive.
  const internal = { DeviceIdentifier: 'disk0', DeviceNode: '/dev/disk0', MediaName: 'APPLE SSD AP0512Z', Size: 500277792768, WholeDisk: true, Internal: true, Ejectable: false, Removable: false, RemovableMediaOrExternalDevice: false, SystemImage: false, BusProtocol: 'Apple Fabric' }
  const card = { DeviceIdentifier: 'disk4', DeviceNode: '/dev/disk4', MediaName: 'SDXC Card', Size: 63864569856, WholeDisk: true, Internal: false, Ejectable: true, Removable: true, RemovableMediaOrExternalDevice: true, SystemImage: false, BusProtocol: 'USB' }

  it('allows a removable whole disk', () => {
    expect(flashRefusalReason(card)).toBeNull()
  })

  it('refuses the internal drive, and says that is why', () => {
    expect(flashRefusalReason(internal)).toMatch(/internal disk/)
  })

  it('refuses a partition and explains what to pass instead', () => {
    expect(flashRefusalReason({ ...card, DeviceIdentifier: 'disk4s1', WholeDisk: false })).toMatch(/whole device/)
  })

  it('refuses the running system before anything else', () => {
    expect(flashRefusalReason({ ...card, SystemImage: true })).toMatch(/running macOS system/)
  })

  it('refuses a disk that is neither removable nor external', () => {
    expect(flashRefusalReason({ ...card, Removable: false, Ejectable: false, RemovableMediaOrExternalDevice: false })).toMatch(/neither removable nor external/)
  })

  it('accepts a card that only one of the three flags calls removable', () => {
    expect(flashRefusalReason({ ...card, Removable: false, Ejectable: false })).toBeNull()
  })

  it('describes a disk well enough to recognise it before writing', () => {
    expect(describeDisk(card)).toBe('/dev/disk4 - SDXC Card, 63.9 GB, USB')
  })
})

describe('resolveBootVolume', () => {
  it('finds the volume for each OS family', () => {
    expect(resolveBootVolume({ bootVolume: 'bootfs' }, path => path === '/Volumes/bootfs')).toBe('/Volumes/bootfs')
    expect(resolveBootVolume({ bootVolume: 'system-boot' }, path => path === '/Volumes/system-boot')).toBe('/Volumes/system-boot')
  })

  it('finds the counter-suffixed mount macOS makes on a re-write', () => {
    expect(resolveBootVolume({ bootVolume: 'bootfs' }, path => path === '/Volumes/bootfs 1')).toBe('/Volumes/bootfs 1')
  })

  it('reports nothing when the card is not mounted yet', () => {
    expect(resolveBootVolume({ bootVolume: 'bootfs' }, () => false)).toBeNull()
  })
})

describe('parseDnsSdBrowse', () => {
  const output = [
    'Browsing for _ssh._tcp.local',
    'DATE: ---Wed 02 Sep 2026---',
    '11:47:12.345  ...STARTING...',
    'Timestamp     A/R    Flags  if Domain               Service Type         Instance Name',
    '11:47:12.346  Add        3   6 local.               _ssh._tcp.           pi-stacks',
    '11:47:12.347  Add        3   6 local.               _ssh._tcp.           chris\\032mbp',
    '11:47:13.001  Rmv        0   6 local.               _ssh._tcp.           old-board',
  ].join('\n')

  it('lists the hosts advertising SSH, as names we can connect to', () => {
    expect(parseDnsSdBrowse(output)).toEqual([
      { name: 'chris mbp', hostname: 'chris-mbp.local' },
      { name: 'pi-stacks', hostname: 'pi-stacks.local' },
    ])
  })

  it('drops a host that went away rather than offering a board that rebooted', () => {
    expect(parseDnsSdBrowse(output).some(host => host.name === 'old-board')).toBe(false)
  })

  it('is unbothered by output with no hosts in it', () => {
    expect(parseDnsSdBrowse('Browsing for _ssh._tcp.local\n')).toEqual([])
    expect(parseDnsSdBrowse('')).toEqual([])
  })
})
