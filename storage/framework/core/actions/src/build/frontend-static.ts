import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { publicPath, resourcesPath, storagePath } from '@stacksjs/path'

const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v')

function debug(...args: any[]): void {
  if (isVerbose)
    console.log('🔍', ...args)
}

/**
 * Loads the STX signals runtime (client-side reactivity) as an inline
 * `<script>` block, or an empty string when the runtime cannot be resolved.
 */
async function getSignalsRuntime(): Promise<string> {
  try {
    const { generateSignalsRuntime } = await import(
      // @ts-ignore - dynamic import, module may not be installed
      /* @vite-ignore */ '@stacksjs/stx/signals'
    )
    return `<script>\n${generateSignalsRuntime()}\n</script>`
  }
  catch {
    console.warn('Could not load STX signals runtime')
    return ''
  }
}

/** Recursively copy a directory tree. */
function copyDir(src: string, dest: string): void {
  if (!existsSync(dest))
    mkdirSync(dest, { recursive: true })
  for (const item of readdirSync(src)) {
    if (item === '.DS_Store')
      continue
    const srcPath = join(src, item)
    const destPath = join(dest, item)
    if (statSync(srcPath).isDirectory())
      copyDir(srcPath, destPath)
    else
      copyFileSync(srcPath, destPath)
  }
}

export interface BuildFrontendStaticOptions {
  /**
   * Output directory for the static site. Defaults to
   * `storage/framework/frontend-dist` — the `root` the `sites.public`
   * cloud config expects.
   */
  outDir?: string
}

/**
 * Build the marketing / public static site.
 *
 * Pre-renders `resources/views/index.stx` to a static `index.html`,
 * copies `resources/assets` into `<outDir>/assets`, and copies the
 * project `public/` directory into `<outDir>`. This is the source of
 * truth previously inlined in the AWS deploy action's "Deploy frontend
 * to S3" block; the deploy action now calls this function and uploads
 * the resulting directory to S3.
 *
 * @returns The absolute path to the built static-site directory.
 */
export async function buildFrontendStatic(options: BuildFrontendStaticOptions = {}): Promise<string> {
  const buildDir = options.outDir ?? storagePath('framework/frontend-dist')

  // Clean and create build directory
  if (existsSync(buildDir))
    rmSync(buildDir, { recursive: true })
  mkdirSync(buildDir, { recursive: true })
  mkdirSync(join(buildDir, 'assets'), { recursive: true })

  // Build the frontend index.html from the STX template
  const indexPath = resourcesPath('views/index.stx')
  if (existsSync(indexPath)) {
    let stxContent = readFileSync(indexPath, 'utf-8')

    // Pre-render the STX template to static HTML
    // 1. Extract and evaluate <script server> block
    const serverBlockMatch = stxContent.match(/<script server>([\s\S]*?)<\/script>/)
    let serverVars: Record<string, any> = {}

    if (serverBlockMatch) {
      const serverCode = serverBlockMatch[1] ?? ''

      try {
        // Evaluate the server block using new Function() to properly handle
        // backtick template literals, complex arrays, and nested objects
        const varNames = [...serverCode.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g)]
          .map(m => m[1])
          .filter((name): name is string => Boolean(name))
        // eslint-disable-next-line no-new-func
        const evalFn = new Function(`${serverCode}\nreturn { ${varNames.join(', ')} }`)
        serverVars = evalFn()
      }
      catch (evalErr) {
        debug(`  Server block evaluation failed: ${evalErr}, falling back to regex`)
        // Fallback: extract simple const string/number assignments via regex
        const constMatches = serverCode.matchAll(/const\s+(\w+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([\d.]+))/g)
        for (const m of constMatches) {
          const name = m[1]
          if (name)
            serverVars[name] = m[2] ?? m[3] ?? m[4]
        }
      }

      // Remove the <script server> block from output
      stxContent = stxContent.replace(/<script server>[\s\S]*?<\/script>\s*/, '')
    }

    // 2. Replace {{ variable }} interpolations (simple top-level vars)
    stxContent = stxContent.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
      const val = serverVars[varName]
      return val !== undefined && val !== null ? String(val) : ''
    })

    // 3. Process @foreach blocks
    const foreachRegex = /@foreach\s*\((\w+)\s+as\s+(\w+)\)([\s\S]*?)@endforeach/g
    stxContent = stxContent.replace(foreachRegex, (_, collectionName, itemVar, template) => {
      const collection = serverVars[collectionName]
      if (!Array.isArray(collection) || collection.length === 0)
        return ''

      let rendered = ''
      for (const item of collection) {
        let itemHtml = template
        // Replace {{ item.prop }}
        itemHtml = itemHtml.replace(new RegExp(`\\{\\{\\s*${itemVar}\\.(\\w+)\\s*\\}\\}`, 'g'), (_match: string, prop: string) => {
          const val = (item as Record<string, any>)[prop]
          return val !== undefined && val !== null ? String(val) : ''
        })
        // Replace {!! item.prop !!} (raw/unescaped HTML)
        itemHtml = itemHtml.replace(new RegExp(`\\{!!\\s*${itemVar}\\.(\\w+)\\s*!!\\}`, 'g'), (_match: string, prop: string) => {
          const val = (item as Record<string, any>)[prop]
          return val !== undefined && val !== null ? String(val) : ''
        })
        rendered += itemHtml
      }
      return rendered
    })

    // 4. Strip server-side STX layout directives for static marketing deploys.
    stxContent = stxContent
      .replace(/^\s*@extends\([^)]+\)\s*$/gm, '')
      .replace(/^\s*@include\([^)]+\)\s*$/gm, '')
      .replace(/^\s*@section\('title',\s*['"][^'"]*['"]\)\s*$/gm, '')
      .replace(/^\s*@section\('(?:content|footer)'\)\s*$/gm, '')
      .replace(/^\s*@endsection\s*$/gm, '')

    // Inject STX signals runtime if reactive directives are present
    // The runtime must load BEFORE any scope scripts that use state()/effect()
    if (/data-stx-scope|@model|@show|@text|@class|@style|@bind:|@if=|@for=/.test(stxContent)) {
      const signalsRuntime = await getSignalsRuntime()
      if (signalsRuntime) {
        // Inject right after <body> tag so it loads before scope scripts
        const bodyMatch = stxContent.match(/<body[^>]*>/)
        if (bodyMatch) {
          const insertPos = (stxContent.indexOf(bodyMatch[0]) ?? 0) + bodyMatch[0].length
          stxContent = stxContent.slice(0, insertPos) + '\n' + signalsRuntime + stxContent.slice(insertPos)
        }
        else {
          // No body tag found, prepend
          stxContent = signalsRuntime + '\n' + stxContent
        }
        debug('  Injected STX signals runtime for client-side reactivity')
      }
    }

    writeFileSync(join(buildDir, 'index.html'), stxContent)
    debug('  Built index.html from STX template')
  }
  else {
    // Fallback to default index
    const defaultIndex = `<!DOCTYPE html>
<html><head><title>Stacks</title></head>
<body><h1>Welcome to Stacks</h1></body></html>`
    writeFileSync(join(buildDir, 'index.html'), defaultIndex)
  }

  // Copy resources/assets directory into <outDir>/assets
  const assetsPath = resourcesPath('assets')
  if (existsSync(assetsPath)) {
    copyDir(assetsPath, join(buildDir, 'assets'))
    debug('  Copied resources/assets directory')
  }

  // Copy project public/ directory into <outDir> (favicons, images, etc.)
  const projectPublic = publicPath()
  if (existsSync(projectPublic)) {
    copyDir(projectPublic, buildDir)
    debug('  Copied public/ directory')
  }

  return buildDir
}

// When invoked directly (e.g. `bun .../build/frontend-static.ts` via
// `runAction(Action.BuildFrontendStatic)`), build into the default dir.
if (import.meta.main) {
  const outDir = await buildFrontendStatic()
  console.log(`✓ Built frontend static site → ${outDir}`)
}
