import type { StyleGuideConfig } from '../src/style-guide'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateStyleGuide, runStyleGuide, styleGuideCssTokens } from '../src/style-guide'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(): Promise<{ root: string, config: StyleGuideConfig }> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-style-guide-'))
  roots.push(root)
  await mkdir(join(root, 'resources/components'), { recursive: true })
  await mkdir(join(root, 'docs/style-guide'), { recursive: true })
  await writeFile(join(root, 'docs/style-guide/index.md'), 'An authored brand guide.\n')
  await writeFile(join(root, 'resources/components/Action.stx'), `<script server>
/** @description A real action, not a rendered duplicate. */
const localCounter = 2
export const label = $props.label || 'Save'
</script>
<button type="button" class="action">{{ label }}</button>`)
  await writeFile(join(root, 'resources/components/Action.story.stx'), `<!--
@prop {string} label Action text.
@event click Activates the action.
-->
<Story title="Actions" group="Controls" component="app/Action">
  <Variant title="Default"><Action label="Save plan" /></Variant>
  <Variant title="Long label"><Action label="Save the entire training plan" /></Variant>
</Story>`)
  return {
    root,
    config: {
      brand: { name: 'Example brand', accent: '#2457e8' },
      sources: [{ id: 'app', directory: 'resources/components' }],
      styles: { utilities: false, css: '.action{background:#2457e8;color:white}' },
      tokens: { Colors: [{ name: 'action', value: '#2457e8' }] },
      output: { publicUrl: '/docs/style-guide/generated' },
    },
  }
}

describe('native style guide generation', () => {
  test('uses real STX components, publishes accurate contracts and keeps authored docs', async () => {
    const { root, config } = await fixture()
    expect(await generateStyleGuide(config, { root })).toEqual({ components: 1, stories: 1, variants: 2, checked: false })
    const catalog = JSON.parse(await readFile(join(root, 'docs/public/style-guide/generated/catalog.json'), 'utf8'))
    expect(catalog.components[0].props).toEqual([{ name: 'label', type: 'string', description: 'Action text.' }])
    expect(catalog.components[0].events).toEqual(['click Activates the action.'])
    expect(catalog.components[0].props.some((prop: { name: string }) => prop.name === 'localCounter')).toBe(false)
    const manifest = JSON.parse(await readFile(join(root, 'docs/style-guide/generated/manifest.json'), 'utf8'))
    const previewPath = Object.keys(manifest.files).find(path => path.endsWith('-default-default.html'))!
    const preview = await readFile(join(root, previewPath), 'utf8')
    expect(preview).toContain('Save plan</button>')
    expect(preview).not.toContain('<Action')
    expect(preview).not.toContain(root)
    expect(preview).toContain("connect-src 'none'")
    expect(await readFile(join(root, 'docs/style-guide/index.md'), 'utf8')).toBe('An authored brand guide.\n')
    expect((await generateStyleGuide(config, { root, check: true })).checked).toBe(true)
  })

  test('check is read-only and catches changed source, tokens, removed sources and tampered outputs', async () => {
    const { root, config } = await fixture()
    await generateStyleGuide(config, { root })
    const manifestPath = join(root, 'docs/style-guide/generated/manifest.json')
    const before = await readFile(manifestPath, 'utf8')
    config.tokens!.Colors![0]!.value = '#ff0000'
    await expect(generateStyleGuide(config, { root, check: true })).rejects.toThrow('stale')
    expect(await readFile(manifestPath, 'utf8')).toBe(before)
    await generateStyleGuide(config, { root })
    await writeFile(join(root, 'docs/style-guide/generated/foundations.md'), 'Manual change')
    await expect(generateStyleGuide(config, { root, check: true })).rejects.toThrow('output is stale')
    await generateStyleGuide(config, { root })
    await writeFile(join(root, 'resources/components/Action.stx'), '<button>Changed</button>')
    await expect(generateStyleGuide(config, { root, check: true })).rejects.toThrow('stale')
    await rm(join(root, 'resources/components/Action.stx'))
    await rm(join(root, 'resources/components/Action.story.stx'))
    await expect(generateStyleGuide(config, { root, check: true })).rejects.toThrow('stale')
    await generateStyleGuide(config, { root })
    await expect(readFile(join(root, 'docs/style-guide/generated/components/app/Action.md'))).rejects.toThrow()
    expect(await readFile(join(root, 'docs/style-guide/index.md'), 'utf8')).toContain('authored')
  })

  test('copies local production assets and catches changed font bytes', async () => {
    const { root, config } = await fixture()
    await mkdir(join(root, 'public/fonts'), { recursive: true })
    await writeFile(join(root, 'public/fonts/brand.woff2'), 'first-font')
    config.styles!.css = '@font-face{font-family:Brand;src:url(/fonts/brand.woff2)}'
    await generateStyleGuide(config, { root })
    const css = await readFile(join(root, 'docs/public/style-guide/generated/components.css'), 'utf8')
    expect(css).toContain('./assets/')
    expect(css).not.toContain('/fonts/brand.woff2')
    await writeFile(join(root, 'public/fonts/brand.woff2'), 'changed-font')
    await expect(generateStyleGuide(config, { root, check: true })).rejects.toThrow('stale')
  })

  test('renders both appearances without automatically loading application stores', async () => {
    const { root, config } = await fixture()
    await mkdir(join(root, 'stores'), { recursive: true })
    await writeFile(join(root, 'stores/account.ts'), 'const NEVER_PUBLISH_ACCOUNT_STORE = "private account machinery"')
    await writeFile(join(root, 'resources/components/Action.story.stx'), `<script client>
const saved = state(false)
</script>
<Story title="Actions" component="app/Action"><Variant title="Default"><Action /><p :text="saved ? 'Saved' : 'Ready'"></p></Variant></Story>`)
    config.preview = { appearances: [{ name: 'Light', background: '#fff', foreground: '#111' }, { name: 'Dark', bodyClass: 'dark', background: '#111', foreground: '#fff' }] }
    await generateStyleGuide(config, { root })
    const manifest = JSON.parse(await readFile(join(root, 'docs/style-guide/generated/manifest.json'), 'utf8'))
    const previews = Object.keys(manifest.files).filter(path => /-default-(light|dark)\.html$/.test(path))
    expect(previews).toHaveLength(2)
    for (const path of previews) {
      const source = await readFile(join(root, path), 'utf8')
      expect(source).not.toContain('NEVER_PUBLISH_ACCOUNT_STORE')
      expect(source).not.toContain('data-stx-stores')
    }
    expect(await readFile(join(root, previews.find(path => path.endsWith('-dark.html'))!), 'utf8')).toContain('<html lang="en" class="dark">')
    expect((await generateStyleGuide(config, { root, check: true })).checked).toBe(true)
  })

  test('reads declared props across script blocks without turning state into props', async () => {
    const { root, config } = await fixture()
    await writeFile(join(root, 'resources/components/Action.stx'), `<script>
interface Props {
  /** Displayed action text. */
  label?: string
  variant: 'primary' | 'secondary'
}
const { label = 'Save' } = defineProps<Props>()
</script>
<script client>const internalState = state(false)</script>
<button>{{ label }}</button>`)
    await rm(join(root, 'resources/components/Action.story.stx'))
    await generateStyleGuide(config, { root })
    const catalog = JSON.parse(await readFile(join(root, 'docs/public/style-guide/generated/catalog.json'), 'utf8'))
    expect(catalog.components[0].props).toEqual([
      { name: 'label', type: 'string', description: 'Optional. Displayed action text.' },
      { name: 'variant', type: "'primary' | 'secondary'", description: 'Required.' },
    ])
  })

  test('preserves identical output on repeated generation with static fixtures', async () => {
    const { root, config } = await fixture()
    await generateStyleGuide(config, { root })
    const before = await readFile(join(root, 'docs/style-guide/generated/manifest.json'), 'utf8')
    await generateStyleGuide(config, { root })
    expect(await readFile(join(root, 'docs/style-guide/generated/manifest.json'), 'utf8')).toBe(before)
  })

  test('retains contracts from multiple fixtures and detects a changed rendered image', async () => {
    const { root, config } = await fixture()
    await mkdir(join(root, 'public/images'), { recursive: true })
    await writeFile(join(root, 'public/images/brand.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(join(root, 'resources/components/Other.story.stx'), `<!--
@description An explicitly documented action.
@prop {boolean} disabled Prevents activation.
-->
<Story title="Other action states" component="app/Action"><Variant title="Logo"><Action /><img src="/images/brand.svg" alt="Example brand"></Variant></Story>`)
    await generateStyleGuide(config, { root })
    const catalog = JSON.parse(await readFile(join(root, 'docs/public/style-guide/generated/catalog.json'), 'utf8'))
    expect(catalog.components[0].props.map((prop: { name: string }) => prop.name)).toEqual(['disabled', 'label'])
    expect(catalog.components[0].description).toBe('A real action, not a rendered duplicate.')
    expect((await generateStyleGuide(config, { root, check: true })).checked).toBe(true)
    await writeFile(join(root, 'public/images/brand.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><title>Changed</title></svg>')
    await expect(generateStyleGuide(config, { root, check: true })).rejects.toThrow('stale')
  })

  test('refuses unowned collisions, escaping outputs, symlinks and forged deletion paths', async () => {
    const { root, config } = await fixture()
    config.output!.docs = '../elsewhere'
    await expect(generateStyleGuide(config, { root })).rejects.toThrow('inside the project')
    delete config.output!.docs
    await mkdir(join(root, 'docs/style-guide/generated'), { recursive: true })
    await writeFile(join(root, 'docs/style-guide/generated/index.md'), 'Keep me')
    await expect(generateStyleGuide(config, { root })).rejects.toThrow('unowned')
    expect(await readFile(join(root, 'docs/style-guide/generated/index.md'), 'utf8')).toBe('Keep me')
    await rm(join(root, 'docs/style-guide/generated'), { recursive: true })
    await symlink(join(root, 'resources'), join(root, 'docs/style-guide/generated'))
    await expect(generateStyleGuide(config, { root })).rejects.toThrow('symlink')
    await rm(join(root, 'docs/style-guide/generated'))
    await generateStyleGuide(config, { root })
    const manifest = join(root, 'docs/style-guide/generated/manifest.json')
    const saved = JSON.parse(await readFile(manifest, 'utf8'))
    saved.files['docs/style-guide/index.md'] = 'fake'
    await writeFile(manifest, JSON.stringify(saved))
    await expect(generateStyleGuide(config, { root })).rejects.toThrow('invalid owned path')
    expect(await readFile(join(root, 'docs/style-guide/index.md'), 'utf8')).toContain('authored')
  })

  test('rejects malformed fixtures and broken component associations instead of claiming coverage', async () => {
    const { root, config } = await fixture()
    await writeFile(join(root, 'resources/components/Action.story.stx'), '<Story title="Missing variants"></Story>')
    await expect(generateStyleGuide(config, { root })).rejects.toThrow('explicit, nonempty Variants')
    await writeFile(join(root, 'resources/components/Action.story.stx'), '<Story title="Bad" component="app/Missing"><Variant title="One"><div>Hi</div></Variant></Story>')
    await expect(generateStyleGuide(config, { root })).rejects.toThrow('unknown component')
  })

  test('duplicate filenames in different libraries have distinct pages and stable IDs', async () => {
    const { root, config } = await fixture()
    await mkdir(join(root, 'library'), { recursive: true })
    await writeFile(join(root, 'library/Action.stx'), '<a href="/example">Example</a>')
    config.sources.push({ id: 'library', directory: 'library' })
    await generateStyleGuide(config, { root })
    const catalog = JSON.parse(await readFile(join(root, 'docs/public/style-guide/generated/catalog.json'), 'utf8'))
    expect(catalog.components.map((component: { id: string }) => component.id)).toEqual(['app/Action', 'library/Action'])
    expect(await readFile(join(root, 'docs/style-guide/generated/components/library/Action.md'), 'utf8')).toContain('library/Action')
  })

  test('build integration is opt-in, explicit CLI use requires a config', async () => {
    const { root } = await fixture()
    expect(await runStyleGuide({ root, optional: true })).toBeUndefined()
    await expect(runStyleGuide({ root })).rejects.toThrow('create config/style-guide.ts')
  })

  test('extracts production CSS variables from the requested block', () => {
    expect(styleGuideCssTokens(':root { --brand: #dd0f15; --font: Barlow, sans-serif; }')).toEqual([
      { name: '--brand', value: '#dd0f15' }, { name: '--font', value: 'Barlow, sans-serif' },
    ])
    expect(() => styleGuideCssTokens('body { color:red }')).toThrow('no token block')
  })
})
