import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

/** Never read: build output, dependencies, and state a checkout does not own. */
const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', 'coverage', '.zig-cache', 'zig-cache', 'pantry', '.cache'])

const BINARY_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'icns', 'bmp', 'tiff', 'heic', 'mp3', 'mp4', 'mov', 'webm', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'pdf', 'zip', 'gz', 'tgz', 'br', 'zst', 'xz', '7z', 'tar', 'wasm', 'so', 'dylib', 'a', 'o', 'node', 'db', 'sqlite', 'sqlite3', 'mdb', 'psd', 'ai', 'sketch', 'fig', 'car', 'nib', 'riv', 'lottie', 'glb', 'gltf', 'usdz', 'fit', 'bin', 'dat', 'map'])

/** Generated or locked files: huge, not written by a person, and noisy for pattern scans. */
const SKIPPED_FILES = /(^|\/)(bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|pantry\.lock|Cargo\.lock|Package\.resolved|Podfile\.lock)$|\.min\.(js|css)$|\.snap$/

/** Only files this large or smaller are read. */
export const MAX_FILE_BYTES = 1_000_000

export function isScannable(path: string): boolean {
  if (SKIPPED_FILES.test(path)) return false
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return !BINARY_EXTENSIONS.has(extension)
}

/** Whether a file is a test, fixture or example, where fake credentials are normal. */
export function isTestPath(path: string): boolean {
  return /(^|\/)(tests?|__tests__|__mocks__|fixtures?|examples?|e2e|mocks?|stubs?|seeders?|bench|benchmarks?)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)
}

/** Whether a file is documentation, where credentials are placeholders by convention. */
export function isDocPath(path: string): boolean {
  return /\.(md|mdx|txt|rst)$/i.test(path) || /(^|\/)docs?\//.test(path)
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) await walk(root, join(dir, entry.name), out)
    }
    else if (entry.isFile()) {
      out.push(relative(root, join(dir, entry.name)))
    }
  }
}

/**
 * The files a scan covers: what git tracks, so ignored files (`.env`, build
 * output) are not reported as the project's own, or every file under the
 * directory when it is not a git checkout. Project-relative, sorted.
 */
export async function projectFiles(cwd: string): Promise<{ files: string[], tracked: boolean }> {
  try {
    const proc = Bun.spawn(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, stdout: 'pipe', stderr: 'ignore' })
    const [text, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    if (code === 0) {
      const files: string[] = []
      for (const path of text.split('\0')) {
        if (!path || path.split('/').some(part => SKIPPED_DIRS.has(part))) continue
        // A deleted-but-listed file or a submodule/symlink to a directory has nothing to read.
        const info = await stat(join(cwd, path)).catch(() => null)
        if (info?.isFile()) files.push(path)
      }
      return { files: [...new Set(files)].sort(), tracked: true }
    }
  }
  catch {}
  const files: string[] = []
  await walk(cwd, cwd, files)
  return { files: files.sort(), tracked: false }
}
