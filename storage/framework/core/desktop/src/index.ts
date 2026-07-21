import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Desktop {
  app: unknown
  core: unknown
  dpi: unknown
  event: unknown
  image: unknown
  menu: unknown
  mocks: unknown
  path: unknown
  tray: unknown
  webview: unknown
  webviewWindow: unknown
  window: unknown
}

// let _desktop: Desktop | undefined

// export async function getDesktop(): Promise<Desktop> {
//   if (_desktop) return _desktop

//   const tauri = await import('@tauri-apps/api')
//   _desktop = {
//     app: tauri.app,
//     core: tauri.core,
//     dpi: tauri.dpi,
//     event: tauri.event,
//     image: tauri.image,
//     menu: tauri.menu,
//     mocks: tauri.mocks,
//     path: tauri.path,
//     tray: tauri.tray,
//     webview: tauri.webview,
//     webviewWindow: tauri.webviewWindow,
//     window: tauri.window,
//   }

//   return _desktop
// }

export interface OpenDevWindowOptions {
  url?: string
  title?: string
  width?: number
  height?: number
  darkMode?: boolean
  hotReload?: boolean
  nativeSidebar?: boolean
  sidebarWidth?: number
  sidebarConfig?: unknown
  devTools?: boolean
  craftBin?: string
  systemTray?: boolean
  hideDockIcon?: boolean
  menubarOnly?: boolean
}

export type CraftLauncher = (command: string[]) => void | Promise<void>

export function resolveCraftBinary(explicit: string | undefined = process.env.CRAFT_BIN): string {
  if (explicit) {
    if (!existsSync(explicit))
      throw new Error(`Craft binary not found: ${explicit}`)
    return explicit
  }

  const craftRoot = join(homedir(), 'Code/Tools/craft')
  const candidates = [
    join(craftRoot, 'packages/zig/zig-out/bin/craft'),
    join(craftRoot, 'craft'),
    join(craftRoot, 'bin/craft'),
  ]

  return candidates.find(candidate => existsSync(candidate)) || 'craft'
}

export function resolveDevWindowUrl(port: number, options: OpenDevWindowOptions = {}): string {
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new RangeError(`Invalid desktop development port: ${port}`)

  const configured = options.url || process.env.APP_URL
  if (!configured)
    return `https://stacks.test`

  const withProtocol = /^https?:\/\//.test(configured) ? configured : `https://${configured}`
  return new URL(withProtocol).toString().replace(/\/$/, '')
}

export function craftDevCommand(port: number, options: OpenDevWindowOptions = {}): string[] {
  const command = [
    resolveCraftBinary(options.craftBin),
    resolveDevWindowUrl(port, options),
    '--title',
    options.title || 'Stacks',
    '--width',
    String(options.width || 1400),
    '--height',
    String(options.height || 900),
  ]

  if (options.hotReload !== false) command.push('--hot-reload')
  if (options.devTools === false) command.push('--no-devtools')
  if (options.darkMode) command.push('--dark')
  if (options.systemTray) command.push('--system-tray')
  if (options.hideDockIcon) command.push('--hide-dock-icon')
  if (options.menubarOnly) command.push('--menubar-only')

  return command
}

export interface InviteLinkOptions {
  email?: string
  team?: string
  role?: string
  expiresAt?: Date | string
}

export function createInviteLink(baseUrl: string, token: string, options: InviteLinkOptions = {}): string {
  if (!token.trim())
    throw new Error('Invite token is required')

  const url = new URL('/invite', /^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`)
  url.searchParams.set('token', token)
  if (options.email) url.searchParams.set('email', options.email)
  if (options.team) url.searchParams.set('team', options.team)
  if (options.role) url.searchParams.set('role', options.role)
  if (options.expiresAt) {
    const date = options.expiresAt instanceof Date ? options.expiresAt : new Date(options.expiresAt)
    if (Number.isNaN(date.valueOf()))
      throw new Error('Invite expiration must be a valid date')
    url.searchParams.set('expires', date.toISOString())
  }
  return url.toString()
}

export function createUpdateManifestUrl(baseUrl: string, channel = 'stable'): string {
  if (!/^[a-z0-9-]+$/i.test(channel))
    throw new Error('Update channel may only contain letters, numbers, and hyphens')
  return new URL(`/desktop/updates/${channel}.json`, /^https?:\/\//.test(baseUrl) ? baseUrl : `https://${baseUrl}`).toString()
}

async function launchCraft(command: string[]): Promise<void> {
  const process = Bun.spawn(command, {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  process.unref()
}

export async function openDevWindow(
  port: number,
  options: OpenDevWindowOptions = {},
  launcher: CraftLauncher = launchCraft,
): Promise<boolean> {
  await launcher(craftDevCommand(port, options))
  return true
}
