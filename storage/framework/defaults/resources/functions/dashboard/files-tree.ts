/**
 * Build the dashboard File Manager tree from a real Storage disk.
 *
 * The `content/files` page seeds its grid with this at request time (from a
 * `<script server>` block) so it browses actual files through @stacksjs/storage
 * instead of demo data. Defaults to the `public` disk, which carries real media
 * plus public URLs, so image/video previews render. Bounded in depth and entry
 * count so a large disk can't blow up SSR, and returns `null` on any error or an
 * empty disk so the page falls back to its built-in demo tree.
 *
 * Usage from a page's `<script server>`:
 *
 *   const { buildStorageFileTree } =
 *     await import('../../../resources/functions/dashboard/files-tree')
 *   const tree = await buildStorageFileTree({ disk: 'public' })
 */
import { Storage } from '@stacksjs/storage'

export interface FileTreeNode {
  id: number
  name: string
  type: string
  size?: number
  path: string
  lastModified: string
  starred: boolean
  shared: boolean
  mime_type?: string
  url?: string
  items?: FileTreeNode[]
}

export interface BuildFileTreeOptions {
  /** Storage disk to list. @default 'public' */
  disk?: string
  /** How many directory levels to descend. @default 3 */
  maxDepth?: number
  /** Hard cap on total entries, to bound SSR cost. @default 600 */
  maxEntries?: number
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : 'file'
}

function baseNameOf(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

function normalizePath(path: string): string {
  return `/${path}`.replace(/\/+/g, '/')
}

/**
 * List `disk` into a File-Manager tree, or `null` when it can't be listed or is
 * empty (so callers can fall back to demo data). Never throws.
 */
export async function buildStorageFileTree(options: BuildFileTreeOptions = {}): Promise<FileTreeNode | null> {
  const { disk = 'public', maxDepth = 3, maxEntries = 600 } = options

  let adapter: any
  try {
    adapter = Storage.disk(disk)
  }
  catch {
    return null
  }

  let idCounter = 1
  let entryCount = 0

  async function walk(dir: string, name: string, depth: number): Promise<FileTreeNode> {
    const node: FileTreeNode = {
      id: idCounter++,
      name,
      type: 'folder',
      path: normalizePath(dir),
      lastModified: new Date().toISOString(),
      starred: false,
      shared: true,
      items: [],
    }
    if (depth <= 0)
      return node

    const entries: { path: string, type: string }[] = []
    try {
      for await (const entry of adapter.list(dir)) {
        entries.push({ path: String(entry.path), type: String(entry.type) })
        if (entries.length >= maxEntries)
          break
      }
    }
    catch {
      return node
    }

    // Folders first, then files, each alphabetical — matches Finder ordering.
    entries.sort((a, b) => {
      if (a.type !== b.type)
        return a.type === 'directory' ? -1 : 1
      return baseNameOf(a.path).localeCompare(baseNameOf(b.path))
    })

    for (const entry of entries) {
      if (entryCount >= maxEntries)
        break
      const base = baseNameOf(entry.path)
      if (!base || base.startsWith('.'))
        continue
      entryCount++

      if (entry.type === 'directory') {
        node.items!.push(await walk(entry.path, base, depth - 1))
        continue
      }

      let size = 0
      let lastModified = new Date().toISOString()
      let mimeType = ''
      let url = ''
      try {
        const stat = await adapter.stat(entry.path)
        size = Number(stat?.size ?? 0)
        if (stat?.lastModified)
          lastModified = new Date(stat.lastModified).toISOString()
        mimeType = String(stat?.mimeType ?? '')
      }
      catch {}
      try {
        url = await adapter.publicUrl(entry.path)
      }
      catch {}

      node.items!.push({
        id: idCounter++,
        name: base,
        type: extensionOf(base),
        size,
        path: normalizePath(entry.path),
        lastModified,
        mime_type: mimeType,
        url,
        starred: false,
        shared: true,
      })
    }

    return node
  }

  try {
    const tree = await walk('', 'Home', maxDepth)
    return tree.items && tree.items.length > 0 ? tree : null
  }
  catch {
    return null
  }
}
