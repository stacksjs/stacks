import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { emptySidebarOrder, parseSidebarOrder, type SidebarOrder } from '../../../../resources/functions/dashboard/sidebar-order'

export interface SidebarOrderLocation { projectRoot?: string, configHome?: string, viewer?: string }
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32)

/** Outside the checkout: runtime/cache cleanup and framework upgrades preserve personal order. */
export function sidebarOrderPath(options: SidebarOrderLocation = {}): string {
  const root = realpathSync(options.projectRoot ?? process.cwd())
  const configHome = options.configHome ?? process.env.XDG_CONFIG_HOME
    ?? (process.platform === 'darwin' ? join(homedir(), 'Library/Application Support') : join(homedir(), '.config'))
  return join(resolve(configHome), 'stacks/dashboard', hash(root), `${hash(options.viewer ?? 'local')}.json`)
}

export const sidebarOrderScope = (options: SidebarOrderLocation = {}): string => hash(sidebarOrderPath(options))

export async function readSidebarOrder(options: SidebarOrderLocation = {}): Promise<{ order: SidebarOrder, warning?: string }> {
  const path = sidebarOrderPath(options)
  try {
    if ((await stat(path)).size > 256 * 1024) throw new SyntaxError('Oversized sidebar preferences')
    const source = await readFile(path, 'utf8')
    try { return { order: parseSidebarOrder(JSON.parse(source)) } }
    catch { return { order: emptySidebarOrder(), warning: 'Saved sidebar order is invalid. Team defaults are shown; reset order to replace it.' } }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { order: emptySidebarOrder() }
    if (error instanceof SyntaxError) return { order: emptySidebarOrder(), warning: 'Saved sidebar order is invalid. Team defaults are shown; reset order to replace it.' }
    throw error
  }
}

export async function writeSidebarOrder(value: unknown, options: SidebarOrderLocation = {}): Promise<SidebarOrder> {
  const order = parseSidebarOrder(value)
  const path = sidebarOrderPath(options)
  const temporary = `${path}.${randomUUID()}.tmp`
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  // Resolve before writing so a missing project is never mistaken for another project.
  await realpath(options.projectRoot ?? process.cwd())
  try {
    await writeFile(temporary, `${JSON.stringify(order, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await rename(temporary, path)
  }
  finally { await rm(temporary, { force: true }) }
  return order
}
