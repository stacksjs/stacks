import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateCss } from '@stacksjs/stx/dev-server/ts-css'
import { renderTemplateString } from '@stacksjs/stx/render'
import { analyzeComponent } from '@stacksjs/stx/story/collect/analyzer'
import { parseStoryContent } from '@stacksjs/stx/story/collect/parser'

export interface StyleGuideToken {
  name: string
  value: string
  description?: string
}

export interface StyleGuideConfig {
  brand: {
    name: string
    description?: string
    /** A real CSS color, used only for the reference site's accent. */
    accent: string
    background?: string
    foreground?: string
    font?: string
    principles?: string[]
  }
  /** Explicit roots keep libraries opt-in and identities stable across machines. */
  sources: { id: string, directory: string, label?: string, exclude?: string[] }[]
  /** Additional directories of isolated, local-data-only .story.stx fixtures. */
  stories?: string[]
  tokens?: Record<string, StyleGuideToken[]>
  /** Read production styles, rather than copying their rules into the docs. */
  styles?: { files?: string[], css?: string, utilities?: boolean }
  preview?: {
    componentDirs?: string[]
    bodyClass?: string
    appearances?: { name: string, bodyClass?: string, background: string, foreground: string }[]
  }
  output?: {
    docs?: string
    public?: string
    /** BunPress route, without the site's basePath. */
    route?: string
    /** Public URL including the site's basePath. */
    publicUrl?: string
  }
}

export interface StyleGuideComponent {
  id: string
  name: string
  source: string
  library: string
  description: string
  props: { name: string, type: string, description: string }[]
  slots: string[]
  events: string[]
  dependencies: string[]
  stories: string[]
}

export interface StyleGuideResult {
  components: number
  stories: number
  variants: number
  checked: boolean
}

interface InputFile { path: string, source: string, content: string }
interface Story {
  id: string
  title: string
  group: string
  component?: string
  file: InputFile
  variants: { id: string, title: string, source: string }[]
}
interface Manifest {
  format: number
  fingerprint: string
  files: Record<string, string>
  result: Omit<StyleGuideResult, 'checked'>
  assets: string[]
}

const FORMAT = 1
const slash = (value: string): string => value.split(sep).join('/')
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex')
const html = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const cell = (value: string): string => html(value).replaceAll('|', '&#124;').replace(/\r?\n/g, ' ')
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`
const annotations = (content: string, name: string): string[] => [...content.matchAll(new RegExp(`@${name}\\s+([^\\n\\r]+)`, 'g'))].map(match => match[1]!.replace(/\*\/.*$/, '').trim())

/** Extract custom properties from a chosen declaration block, not arbitrary selectors. */
export function styleGuideCssTokens(css: string, selector = ':root'): StyleGuideToken[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1]
  if (!block)
    throw new Error(`Style guide: no token block for ${selector}`)
  return [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+)(?:;|$)/g)]
    .map(match => ({ name: match[1]!, value: match[2]!.trim() }))
}

/** Use explicit public prop contracts; local state is never a component prop. */
function props(content: string): StyleGuideComponent['props'] {
  const found = new Map<string, StyleGuideComponent['props'][number]>()
  const contractName = content.match(/\bdefineProps\s*<\s*(\w+)\s*>/)?.[1]
  if (contractName) {
    const body = content.match(new RegExp(`interface\\s+${contractName}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1]
    for (const match of (body || '').matchAll(/(?:\/\*\*([\s\S]*?)\*\/\s*)?([\w$]+)(\?)?\s*:\s*([^;\n]+)[;\n]?/g)) {
      const name = match[2]!
      found.set(name, { name, type: match[4]!.trim(), description: `${match[3] ? 'Optional. ' : 'Required. '}${(match[1] || '').replace(/\s*\*\s*/g, ' ').trim()}`.trim() })
    }
  }
  for (const match of content.matchAll(/@prop\s+\{([^}]+)\}\s+(\S+)\s*([^\n\r]*)/g)) {
    const name = match[2]!.replace(/^\[|\]$/g, '')
    found.set(name, { name, type: match[1]!, description: match[3]!.replace(/\*\/.*$/, '').trim() })
  }
  for (const match of content.matchAll(/\$props\.([a-z_$][\w$]*)|\buseReactiveProp(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/gi)) {
    const name = match[1] || match[2]!
    if (!found.has(name))
      found.set(name, { name, type: 'Not declared', description: 'Read by the implementation; see source for defaults and accepted values.' })
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function walk(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules')
      continue
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...await walk(path))
    else if (entry.isFile() && entry.name.endsWith('.stx'))
      files.push(path)
  }
  return files
}

function contained(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)
}

async function safeOutput(root: string, path: string): Promise<void> {
  if (!contained(root, path))
    throw new Error(`Style guide: output must be inside the project: ${path}`)
  for (let current = path; current !== root; current = dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Style guide: refusing symlink output: ${current}`)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
    }
  }
}

function route(value: string): string {
  if (!value.startsWith('/') || /[?#<>"'\\]|\/\//.test(value) || value.split('/').includes('..'))
    throw new Error(`Style guide: invalid local route: ${value}`)
  return value.replace(/\/$/, '')
}

function previewDocument(config: StyleGuideConfig, title: string, content: string, appearance: { bodyClass?: string, background: string, foreground: string }): string {
  const css = `:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:24px;background:${appearance.background};color:${appearance.foreground};font-family:${config.brand.font || 'system-ui,sans-serif'}}body>main{max-width:1100px;margin:auto}button,input,select,textarea{font:inherit}@media(max-width:480px){body{padding:16px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`
  return `<!doctype html>\n<html lang="en" class="${html(appearance.bodyClass || '')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>${html(`${config.brand.name}: ${title}`)}</title><link rel="stylesheet" href="./components.css"><style>${css}</style></head><body class="${html(appearance.bodyClass || '')}"><main aria-label="${html(title)}">${content}</main></body></html>\n`
}

export async function loadStyleGuideConfig(root: string = process.cwd(), file = 'config/style-guide.ts'): Promise<StyleGuideConfig | undefined> {
  const path = resolve(root, file)
  if (!existsSync(path))
    return undefined
  const module = await import(pathToFileURL(path).href)
  if (!module.default || typeof module.default !== 'object')
    throw new Error(`Style guide: ${file} must export a configuration object`)
  return module.default as StyleGuideConfig
}

/** Generate an owned reference directory, or verify inputs and every published byte without writing. */
export async function generateStyleGuide(config: StyleGuideConfig, options: { root?: string, check?: boolean } = {}): Promise<StyleGuideResult> {
  const root = await realpath(options.root || process.cwd())
  const docs = resolve(root, config.output?.docs || 'docs/style-guide/generated')
  const assets = resolve(root, config.output?.public || 'docs/public/style-guide/generated')
  const docsRoute = route(config.output?.route || '/style-guide/generated')
  const publicUrl = route(config.output?.publicUrl || '/style-guide/generated')
  await safeOutput(root, docs)
  await safeOutput(root, assets)
  if (docs === assets || contained(docs, assets) || contained(assets, docs))
    throw new Error('Style guide: docs and public output directories must be separate')
  if (!config.brand?.name || !config.sources?.length)
    throw new Error('Style guide: brand.name and at least one component source are required')
  const appearanceNames = config.preview?.appearances?.map(appearance => slug(appearance.name))
  if (appearanceNames && (!appearanceNames.length || appearanceNames.some(name => !name) || new Set(appearanceNames).size !== appearanceNames.length))
    throw new Error('Style guide: appearance names must be nonempty and unique')

  const inputs: InputFile[] = []
  const components: StyleGuideComponent[] = []
  const storyFiles = new Map<string, InputFile>()
  const contracts = new Map<string, string>()
  const sourceIds = new Set<string>()
  for (const source of config.sources) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(source.id) || sourceIds.has(source.id))
      throw new Error(`Style guide: source IDs must be unique lowercase slugs: ${source.id}`)
    sourceIds.add(source.id)
    const directory = resolve(root, source.directory)
    if (contained(directory, docs) || contained(directory, assets) || directory === docs || directory === assets)
      throw new Error('Style guide: outputs cannot be inside component sources')
    for (const path of await walk(directory)) {
      const local = slash(relative(directory, path))
      if (source.exclude?.some(pattern => new Bun.Glob(pattern).match(local)))
        continue
      const file = { path, source: `${source.id}/${local}`, content: await readFile(path, 'utf8') }
      inputs.push(file)
      if (path.endsWith('.story.stx')) {
        storyFiles.set(path, file)
        continue
      }
      const name = basename(path, '.stx')
      // Analyze template composition only. Type arguments such as <Props> and
      // code samples in comments are not rendered child components or slots.
      const template = file.content.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
      const analyzed = analyzeComponent(template, name, file.source)
      contracts.set(`${source.id}/${local.slice(0, -4)}`, file.content)
      components.push({
        id: `${source.id}/${local.slice(0, -4)}`,
        name,
        source: contained(root, path) ? slash(relative(root, path)) : file.source,
        library: source.label || source.id,
        // Only an explicit public description belongs in published documentation.
        description: annotations(file.content, 'description')[0] || '',
        props: props(file.content),
        slots: analyzed.slots.map(slot => slot.name).sort(),
        events: annotations(file.content, 'event'),
        dependencies: [...new Set(analyzed.dependencies)].sort(),
        stories: [],
      })
    }
  }
  for (const [index, directory] of (config.stories || []).entries()) {
    const base = resolve(root, directory)
    for (const path of await walk(base)) {
      if (!path.endsWith('.story.stx') || storyFiles.has(path))
        continue
      const file = { path, source: `stories-${index}/${slash(relative(base, path))}`, content: await readFile(path, 'utf8') }
      inputs.push(file)
      storyFiles.set(path, file)
    }
  }
  const stories: Story[] = []
  for (const file of [...storyFiles.values()].sort((a, b) => a.source.localeCompare(b.source))) {
    const parsed = parseStoryContent(file.content, file.path)
    if (!parsed || parsed.variants.some(variant => !variant.source))
      throw new Error(`Style guide: ${file.source} needs a Story with explicit, nonempty Variants`)
    const id = `${slug(file.source.replace(/\.story\.stx$/, ''))}-${hash(file.source).slice(0, 8)}`
    const component = file.content.match(/<Story\b[^>]*\bcomponent=["']([^"']+)["']/)?.[1]
    const story: Story = { id, title: parsed.title, group: parsed.group || 'Patterns', component, file, variants: parsed.variants.map(variant => ({ id: variant.id, title: variant.title, source: variant.source! })) }
    if (new Set(story.variants.map(variant => variant.id)).size !== story.variants.length)
      throw new Error(`Style guide: duplicate variant titles in ${file.source}`)
    if (component) {
      const target = components.find(item => item.id === component)
      if (!target)
        throw new Error(`Style guide: unknown component ${component} in ${file.source}`)
      target.stories.push(id)
      contracts.set(component, `${contracts.get(component)}\n${file.content}`)
      target.props = props(contracts.get(component)!)
      target.events = [...new Set([...target.events, ...annotations(file.content, 'event')])]
      target.description ||= annotations(file.content, 'description')[0] || ''
    }
    stories.push(story)
  }
  components.sort((a, b) => a.id.localeCompare(b.id))

  const styleFiles = await Promise.all((config.styles?.files || []).map(async file => ({ path: resolve(root, file), source: slash(file), content: await readFile(resolve(root, file), 'utf8') })))
  inputs.push(...styleFiles)
  const utilityCss = config.styles?.utilities === false ? '' : await generateCss(inputs.map(input => input.content).join('\n'), root)
  let css = `${utilityCss}\n${styleFiles.map(file => file.content).join('\n')}\n${config.styles?.css || ''}\n`
  const output = new Map<string, string | Uint8Array>()
  const assetHashes: Record<string, string> = {}
  async function readAsset(url: string): Promise<Buffer> {
    if (!url.startsWith('/') || url.startsWith('//') || /[?#]/.test(url))
      throw new Error(`Style guide: CSS assets must be local public paths: ${url}`)
    const source = resolve(root, 'public', `.${url}`)
    if (!contained(resolve(root, 'public'), source) || !contained(await realpath(resolve(root, 'public')), await realpath(source)))
      throw new Error(`Style guide: asset outside public: ${url}`)
    return readFile(source)
  }
  async function localAsset(url: string): Promise<string> {
    if (url.startsWith('data:') || url.startsWith('#'))
      return url
    const bytes = await readAsset(url)
    const name = `${hash(bytes).slice(0, 12)}-${basename(url)}`
    output.set(join(assets, 'assets', name), bytes)
    assetHashes[url] = hash(bytes)
    return `./assets/${name}`
  }
  const urls = [...new Set([...css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(match => match[1]!))]
  const fontUrls = new Set([...css.matchAll(/@font-face\s*\{[^}]*\}/gi)].flatMap(block => [...block[0].matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(match => match[1]!)))
  for (const url of urls) {
    if (fontUrls.has(url) && !url.startsWith('data:')) {
      // An allow-scripts iframe has an opaque origin. Font requests require
      // CORS even when the stylesheet is local, so ordinary static hosting
      // would silently substitute system faces. Embed only the font bytes;
      // keep their original source hashes in the freshness contract.
      const bytes = await readAsset(url)
      assetHashes[url] = hash(bytes)
      const mime = Bun.file(url).type || 'application/octet-stream'
      css = css.replaceAll(url, `data:${mime};base64,${bytes.toString('base64')}`)
    }
    else {
      css = css.replaceAll(url, await localAsset(url))
    }
  }
  output.set(join(assets, 'components.css'), css)
  const implementation = hash(await readFile(import.meta.path))
  const renderer = JSON.parse(await readFile(resolve(dirname(Bun.resolveSync('@stacksjs/stx/render', import.meta.dir)), '../package.json'), 'utf8')).version as string
  const fingerprint = (): string => hash(json({ format: FORMAT, implementation, renderer, config, inputs: inputs.map(file => [file.source, hash(file.content)]).sort(), utilityCss: hash(utilityCss), assets: Object.fromEntries(Object.entries(assetHashes).sort()) }))
  const manifestPath = join(docs, 'manifest.json')
  let previous: Manifest | undefined
  if (existsSync(manifestPath)) {
    await safeOutput(root, manifestPath)
    previous = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
    if (previous.format !== FORMAT || !previous.files || typeof previous.files !== 'object')
      throw new Error('Style guide: invalid ownership manifest')
    for (const file of Object.keys(previous.files)) {
      const path = resolve(root, file)
      if ((!contained(docs, path) && !contained(assets, path)) || file !== slash(relative(root, path)) || path === manifestPath)
        throw new Error(`Style guide: invalid owned path: ${file}`)
      await safeOutput(root, path)
    }
  }
  const currentAssets = { ...assetHashes }
  let fresh = Boolean(previous)
  for (const url of previous?.assets || []) {
    try { assetHashes[url] = hash(await readAsset(url)) }
    catch { fresh = false }
  }
  fresh &&= previous?.fingerprint === fingerprint()
  if (fresh && previous) {
    for (const [file, digest] of Object.entries(previous.files)) {
      if (!existsSync(resolve(root, file)) || hash(await readFile(resolve(root, file))) !== digest) {
        if (options.check)
          throw new Error(`Style guide output is stale: ${file}. Run buddy docs:style-guide.`)
        fresh = false
        break
      }
    }
  }
  if (fresh && previous)
    return { ...previous.result, checked: Boolean(options.check) }
  if (options.check)
    throw new Error('Style guide is stale. Run buddy docs:style-guide and commit the generated files.')
  for (const key of Object.keys(assetHashes))
    delete assetHashes[key]
  Object.assign(assetHashes, currentAssets)

  const componentPage = (component: StyleGuideComponent): string => `components/${component.id.split('/').map(part => encodeURIComponent(part)).join('/')}`
  const table = (headers: string[], rows: string[][]): string => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')}\n`
  const page = (title: string, body: string): string => `---\ntitle: ${JSON.stringify(`${config.brand.name}: ${title}`)}\ndescription: ${JSON.stringify(`${title}. Production component reference for ${config.brand.name}.`)}\n---\n\n<!-- Generated by buddy docs:style-guide. Edit components, stories or config/style-guide.ts. -->\n\n# ${cell(title)}\n\n${body}\n`
  const link = (path: string, title: string): string => `[${cell(title)}](${docsRoute}/${path})`
  const sidebar: { text: string, link: string }[] = [
    { text: 'Component guide', link: `${docsRoute}/` },
    { text: 'Foundations', link: `${docsRoute}/foundations` },
  ]
  const colorTokens = Object.values(config.tokens || {}).flat().filter(token => /^(?:#[\da-f]{3,8}\b|rgba?\(|hsla?\(|oklch\()/i.test(token.value))
  const fontTokens = Object.entries(config.tokens || {}).filter(([category]) => /typography|fonts/i.test(category)).flatMap(([, tokens]) => tokens)
  const swatches = colorTokens.map(token => `<article style="border:1px solid #8885;min-width:0"><div style="height:80px;background:${html(token.value)}"></div><div style="padding:12px;overflow-wrap:anywhere"><strong>${html(token.name)}</strong><p>${html(token.value)}</p></div></article>`).join('')
  const specimen = `<header style="border-bottom:4px solid ${html(config.brand.accent)};padding-bottom:24px;margin-bottom:24px"><p>Design foundations</p><h1 style="font-size:32px;font-weight:700">${html(config.brand.name)}</h1><p>${html(config.brand.description || '')}</p></header><section aria-label="Color tokens" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px">${swatches}</section><section aria-label="Typography" style="margin-top:32px">${fontTokens.map(token => `<article style="padding:20px 0;border-bottom:1px solid #8884"><p>${html(token.name)}: ${html(token.value)}</p><p style="font-family:${html(token.value)};font-size:28px;line-height:1.35">Training with purpose. Aa 0123456789</p></article>`).join('')}</section>`
  output.set(join(assets, 'foundations.html'), previewDocument(config, 'Foundations', specimen, { background: config.brand.background || '#fff', foreground: config.brand.foreground || '#17202a' }))
  const tokenSections = Object.entries(config.tokens || {}).map(([category, tokens]) => `## ${cell(category)}\n\n${table(['Token', 'Value', 'Purpose'], tokens.map(token => [token.name, token.value, token.description || '']))}`).join('\n')
  output.set(join(docs, 'foundations.md'), page('Foundations', `${cell(config.brand.description || '')}\n\n${(config.brand.principles || []).map(principle => `- ${cell(principle)}`).join('\n')}\n\n${tokenSections}\n## Accessibility and behavior\n\nUse semantic controls, visible keyboard focus, persistent labels and accessible names for icon actions. Test both appearances, reduced motion and touch targets. Destructive actions retain their semantic color when a brand changes. Disabled and busy states must remain distinguishable. The previews show browser rendering; validate native layout and interaction separately.\n\n## Branding and maintenance\n\nRead tokens and styles from the production theme in config/style-guide.ts. Keep brand values out of component fixtures. Add isolated .story.stx variants for normal, disabled, busy, empty, error and boundary states where applicable. Use local fictional data; never import account stores or call services from a story. Regenerate with buddy docs:style-guide. Verify freshness with buddy docs:style-guide:check.\n`))
  output.set(join(docs, 'foundations.md'), `${output.get(join(docs, 'foundations.md'))}\n## Visual specimens\n\n<a href="${publicUrl}/foundations.html">Open branded color and typography specimens</a>\n\n<iframe title="${html(config.brand.name)} foundations" src="${publicUrl}/foundations.html" loading="lazy" sandbox="allow-scripts allow-forms" style="width:100%;height:600px;border:1px solid #8884;border-radius:8px"></iframe>\n`)

  for (const story of stories) {
    const examples: string[] = []
    const scripts = [...story.file.content.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(match => match[0]).join('\n')
    const scopedStyles = [...story.file.content.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(match => match[0]).join('\n')
    for (const variant of story.variants) {
      let rendered = await renderTemplateString(`${scripts}\n${variant.source}\n${scopedStyles}`, story.file.path, {
        options: {
          componentsDir: resolve(root, config.preview?.componentDirs?.[0] || config.sources[0]!.directory),
          additionalComponentsDirs: (config.preview?.componentDirs?.slice(1) || config.sources.slice(1).map(source => source.directory)).map(directory => resolve(root, directory)),
          // Rendering a fixture must never discover the application's account stores.
          storesDir: resolve(root, 'storage/framework/runtime/style-guide/no-stores'),
        },
        context: {},
        processClientScripts: true,
      })
      for (const match of [...rendered.matchAll(/\bsrc=["'](\/[^"']+)["']/g)])
        rendered = rendered.replaceAll(match[1]!, await localAsset(match[1]!))
      const markup = rendered.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      if (/<[A-Z][\w.-]*(?:\s|\/?>)/.test(markup))
        throw new Error(`Style guide: unresolved component in ${story.file.source}: ${variant.title}`)
      rendered = rendered.replace(/<script([^>]*\bdata-stx-runtime\b[^>]*)>([\s\S]*?)<\/script>/gi, (tag, attrs: string, code: string) => {
        if (/\bsrc\s*=/.test(attrs))
          return tag
        const name = `runtime-${hash(code).slice(0, 12)}.js`
        output.set(join(assets, name), code)
        return `<script${attrs} src="./${name}"></script>`
      })
      examples.push(`## ${cell(variant.title)}\n`)
      const appearances = config.preview?.appearances || [{ name: 'Default', bodyClass: config.preview?.bodyClass, background: config.brand.background || '#fff', foreground: config.brand.foreground || '#17202a' }]
      for (const appearance of appearances) {
        const name = `${story.id}-${variant.id}-${slug(appearance.name)}.html`
        // CSP is also set in the page for direct opens; the embedding sandbox removes app-origin access.
        const preview = previewDocument(config, `${story.title}, ${variant.title}, ${appearance.name}`, rendered, appearance)
        output.set(join(assets, name), preview)
        examples.push(`\n<a href="${publicUrl}/${name}">Open ${html(variant.title)} preview (${html(appearance.name)})</a>\n\n<iframe title="${html(`${story.title}: ${variant.title}, ${appearance.name}`)}" src="${publicUrl}/${name}" loading="lazy" sandbox="allow-scripts allow-forms" style="width:100%;height:440px;border:1px solid #8884;border-radius:8px"></iframe>\n`)
      }
      // Copyable examples need the same signal setup and local styles that
      // the preview rendered, rather than references to undeclared state.
      const example = [scripts, variant.source, scopedStyles].filter(Boolean).join('\n\n')
      examples.push(`\n\`\`\`stx\n${example}\n\`\`\`\n`)
    }
    const source = contained(root, story.file.path) ? slash(relative(root, story.file.path)) : story.file.source
    output.set(join(docs, 'patterns', `${story.id}.md`), page(story.title, `Source: \`${source}\`. Group: ${cell(story.group)}. Local demonstration data only.\n\n${examples.join('\n')}`))
    sidebar.push({ text: story.title, link: `${docsRoute}/patterns/${story.id}` })
  }
  for (const component of components) {
    const examples = component.stories.length ? component.stories.map(id => link(`patterns/${id}`, stories.find(story => story.id === id)!.title)).join(', ') : 'Reference only. Add an isolated .story.stx fixture before enabling a preview; this component is never executed by the inventory scan.'
    const body = `${cell(component.description || `${component.name} component in ${component.library}.`)}\n\nSource: \`${component.source}\`. Stable ID: \`${component.id}\`.\n\n## Examples\n\n${examples}\n\n## Props\n\n${component.props.length ? table(['Name', 'Type', 'Contract'], component.props.map(prop => [prop.name, prop.type, prop.description])) : 'No public prop declarations or supported prop reads were detected. Consult the source before assuming a prop contract.'}\n## Slots\n\n${component.slots.length ? component.slots.map(slot => `- \`${cell(slot)}\``).join('\n') : 'No slot outlets detected.'}\n\n## Events\n\n${component.events.length ? component.events.map(event => `- ${cell(event)}`).join('\n') : 'No explicit @event contract documented. DOM bindings and internal event handlers are not inferred as public events.'}\n\n## Composition\n\n${component.dependencies.length ? component.dependencies.map(dependency => `- \`${cell(dependency)}\``).join('\n') : 'No child component tags detected.'}\n`
    output.set(join(docs, `${componentPage(component)}.md`), page(component.name, body))
    sidebar.push({ text: `${component.library}: ${component.name}`, link: `${docsRoute}/${componentPage(component)}` })
  }
  const inventory = components.map(component => `| ${link(componentPage(component), component.name)} | ${cell(component.library)} | ${component.stories.length ? `${component.stories.length} fixture(s)` : 'Reference only'} |`).join('\n')
  const patterns = stories.map(story => `- ${link(`patterns/${story.id}`, story.title)} (${cell(story.group)}, ${story.variants.length} variants)`).join('\n')
  output.set(join(docs, 'index.md'), page(`${config.brand.name} component guide`, `${cell(config.brand.description || '')}\n\n${components.length} components, ${stories.length} isolated stories and ${stories.reduce((count, story) => count + story.variants.length, 0)} variants. Generated from production sources, with ${cell(config.brand.name)} branding.\n\n${link('foundations', 'Foundations, tokens and branding')}\n\n## Patterns and live examples\n\n${patterns || 'No isolated stories configured yet.'}\n\n## All components\n\nEvery configured component is indexed. Reference-only entries do not claim tested behavior or visual coverage.\n\n| Component | Library | Examples |\n| --- | --- | --- |\n${inventory}\n`))
  output.set(join(docs, 'sidebar.json'), json(sidebar))
  output.set(join(assets, 'catalog.json'), json({ brand: config.brand, tokens: config.tokens || {}, components, stories: stories.map(story => ({ id: story.id, title: story.title, group: story.group, source: contained(root, story.file.path) ? slash(relative(root, story.file.path)) : story.file.source, variants: story.variants })) }))
  const result = { components: components.length, stories: stories.length, variants: stories.reduce((count, story) => count + story.variants.length, 0) }
  const files = Object.fromEntries([...output].map(([path, content]): [string, string] => [slash(relative(root, path)), hash(content)]).sort(([a], [b]) => a.localeCompare(b)))
  // Validate the entire write set before changing any file. Only our manifest owns deletion rights.
  for (const path of output.keys()) {
    await safeOutput(root, path)
    if (existsSync(path) && !previous?.files[slash(relative(root, path))])
      throw new Error(`Style guide: refusing to overwrite an unowned file: ${slash(relative(root, path))}`)
  }
  for (const [path, content] of output) {
    await mkdir(dirname(path), { recursive: true })
    const temp = `${path}.style-guide-tmp`
    await safeOutput(root, temp)
    await writeFile(temp, content, { flag: 'wx' })
    try { await rename(temp, path) }
    finally { await rm(temp, { force: true }) }
  }
  for (const file of Object.keys(previous?.files || {})) {
    if (!files[file])
      await rm(resolve(root, file), { force: true })
  }
  await mkdir(docs, { recursive: true })
  await writeFile(manifestPath, json({ format: FORMAT, fingerprint: fingerprint(), files, result, assets: Object.keys(assetHashes).sort() } satisfies Manifest))
  return { ...result, checked: false }
}

export async function runStyleGuide(options: { root?: string, config?: string, check?: boolean, optional?: boolean } = {}): Promise<StyleGuideResult | undefined> {
  const root = resolve(options.root || process.cwd())
  const config = await loadStyleGuideConfig(root, options.config)
  if (!config) {
    if (options.optional)
      return undefined
    throw new Error('Style guide: create config/style-guide.ts first. See the Stacks style guide documentation.')
  }
  return generateStyleGuide(config, { root, check: options.check })
}
