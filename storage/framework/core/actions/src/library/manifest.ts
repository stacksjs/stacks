import type { LibraryConfig } from '@stacksjs/types'
import type { ResolvedLibraryPackage } from './packages'

export interface LibraryManifest {
  name: string
  type: 'module'
  version: string
  description: string
  author?: string
  contributors?: string[]
  license?: string
  private?: true
  homepage?: string
  repository?: { type: string, url: string, directory: string }
  bugs?: { url: string }
  keywords?: string[]
  exports: Record<string, unknown>
  module: string
  types: string
  files: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  publishConfig?: { access: 'public' | 'restricted' }
  stacks: { kind: string, sources: string[], runtime?: 'standalone' | 'stx' }
}

/**
 * Build the package.json a library package publishes.
 *
 * `version` is threaded in rather than read here: every package follows the
 * project version by default, so the release bump has to be the one deciding
 * it, and a package that pinned its own `version` in config keeps that.
 */
export function libraryManifest(
  pkg: ResolvedLibraryPackage,
  config: LibraryConfig | undefined,
  version: string,
  sourcesRelativeToProject: string[],
): LibraryManifest {
  const cfg = config ?? {}
  const repository = cfg.repository
  const directory = `storage/framework/libs/packages/${pkg.slug}`

  const manifest: LibraryManifest = {
    name: pkg.name,
    type: 'module',
    version: pkg.version ?? version,
    description: pkg.description,
    author: cfg.author,
    contributors: cfg.contributors,
    license: pkg.license ?? cfg.license,
    homepage: repository ? `https://github.com/${repository}/tree/main/${directory}#readme` : undefined,
    repository: repository ? { type: 'git', url: `git+https://github.com/${repository}.git`, directory } : undefined,
    bugs: repository ? { url: `https://github.com/${repository}/issues` } : undefined,
    keywords: pkg.keywords.length ? pkg.keywords : undefined,
    // A `web-components` package publishes the single self-registering bundle:
    // its whole point is a script tag that defines the elements. The
    // `components` flavor publishes the tree-shakeable per-component modules.
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: pkg.kind === 'web-components' ? './dist/bundle.js' : './dist/index.js',
        default: pkg.kind === 'web-components' ? './dist/bundle.js' : './dist/index.js',
      },
      './*': {
        types: './dist/*.d.ts',
        import: './dist/*.js',
        default: './dist/*.js',
      },
    },
    module: pkg.kind === 'web-components' ? 'dist/bundle.js' : 'dist/index.js',
    types: 'dist/index.d.ts',
    files: ['README.md', 'dist'],
    dependencies: Object.keys(pkg.dependencies).length ? pkg.dependencies : undefined,
    peerDependencies: Object.keys(pkg.peerDependencies).length ? pkg.peerDependencies : undefined,
    // Recorded so `buddy libs` can report what a built package contains
    // without re-globbing, and so a stale dist is obvious in review.
    stacks: { kind: pkg.kind, sources: sourcesRelativeToProject },
  }

  if (pkg.private)
    manifest.private = true
  else
    manifest.publishConfig = { access: pkg.access }

  // A component library ships CSS beside its modules, and a consumer that
  // cannot `import '@acme/ui/style.css'` has to reach into dist/ by hand.
  if (pkg.kind !== 'functions') {
    (manifest.exports as Record<string, unknown>)['./style.css'] = './dist/bundle.css'
    ;(manifest.exports as Record<string, unknown>)['./custom-elements.json'] = './dist/custom-elements.json'
  }

  return manifest
}

/** Drop `undefined` fields so the written manifest stays diff-clean. */
export function serializeManifest(manifest: LibraryManifest): string {
  return `${JSON.stringify(manifest, (_key, value) => value === undefined ? undefined : value, 2)}\n`
}
