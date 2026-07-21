import { describe, expect, test } from 'bun:test'

describe('desktop module', () => {
  test('openDevWindow is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.openDevWindow).toBe('function')
  })

  test('openDevWindow launches Craft with the pretty project URL', async () => {
    const { openDevWindow } = await import('../src/index')
    let command: string[] = []
    const result = await openDevWindow(3000, { url: 'https://example.test' }, (args) => {
      command = args
    })
    expect(result).toBe(true)
    expect(command).toContain('https://example.test')
    expect(command).toContain('--hot-reload')
  })

  test('openDevWindow accepts port and options', async () => {
    const { openDevWindow } = await import('../src/index')
    let command: string[] = []
    const result = await openDevWindow(8080, {
      url: 'localhost:8080',
      title: 'Dev',
      width: 1024,
      height: 768,
      darkMode: true,
      hotReload: true,
    }, (args) => {
      command = args
    })
    expect(result).toBe(true)
    expect(command.slice(1)).toEqual([
      'https://localhost:8080',
      '--title',
      'Dev',
      '--width',
      '1024',
      '--height',
      '768',
      '--hot-reload',
      '--dark',
    ])
  })

  test('uses Craft native tray flags', async () => {
    const { craftDevCommand } = await import('../src/index')
    const command = craftDevCommand(3009, {
      url: 'https://tray.stacks.test',
      systemTray: true,
      hideDockIcon: true,
      menubarOnly: true,
      devTools: false,
    })
    expect(command).toContain('--system-tray')
    expect(command).toContain('--hide-dock-icon')
    expect(command).toContain('--menubar-only')
    expect(command).toContain('--no-devtools')
  })

  test('builds typed invite and update URLs', async () => {
    const { createInviteLink, createUpdateManifestUrl } = await import('../src/index')
    const invite = new URL(createInviteLink('app.example.com', 'secret', {
      email: 'hello@example.com',
      team: 'framework',
      role: 'admin',
      expiresAt: '2026-08-01T00:00:00.000Z',
    }))
    expect(invite.pathname).toBe('/invite')
    expect(invite.searchParams.get('token')).toBe('secret')
    expect(invite.searchParams.get('email')).toBe('hello@example.com')
    expect(createUpdateManifestUrl('app.example.com')).toBe('https://app.example.com/desktop/updates/stable.json')
  })

  test('uses the Stacks pretty URL as the zero-config default', async () => {
    const { resolveDevWindowUrl } = await import('../src/index')
    const previousAppUrl = process.env.APP_URL
    delete process.env.APP_URL
    expect(resolveDevWindowUrl(3000)).toBe('https://stacks.test')
    if (previousAppUrl) process.env.APP_URL = previousAppUrl
  })

  test('rejects invalid ports before launching Craft', async () => {
    const { resolveDevWindowUrl } = await import('../src/index')
    expect(() => resolveDevWindowUrl(0)).toThrow(RangeError)
  })

  test('Desktop interface shape is consistent with exports', async () => {
    // The module exports the function and interfaces only
    const mod = await import('../src/index')
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('openDevWindow')
    expect(exportKeys).toContain('craftDevCommand')
    expect(exportKeys).toContain('resolveCraftBinary')
  })

  test('keeps unqualified targets experimental and blocks stable release claims', async () => {
    const { assertDesktopReleaseChannel, desktopSupportMatrix } = await import('../src/index')
    expect(desktopSupportMatrix.every(row => row.status === 'experimental')).toBe(true)
    expect(() => assertDesktopReleaseChannel('stable', 'darwin', 'arm64')).toThrow('#2059')
    expect(assertDesktopReleaseChannel('experimental', 'linux', 'x64').packageFormat).toBe('unpackaged bundle')
    expect(() => assertDesktopReleaseChannel('experimental', 'linux', 'arm64')).toThrow('unsupported')
  })
})
