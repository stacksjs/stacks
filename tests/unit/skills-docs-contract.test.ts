import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SKILLS_DIR = resolve('storage/framework/defaults/ai/skills')
const DOCS_DIR = resolve('docs/skills')

const skillNames = readdirSync(SKILLS_DIR)
  .filter(entry => existsSync(join(SKILLS_DIR, entry, 'SKILL.md')))
  .sort()

/** Every `docs/skills/<section>/<slug>.md`, as `<section>/<slug>`. */
const docPages = readdirSync(DOCS_DIR)
  .filter(entry => statSync(join(DOCS_DIR, entry)).isDirectory())
  .flatMap(section =>
    readdirSync(join(DOCS_DIR, section))
      .filter(file => file.endsWith('.md'))
      .map(file => `${section}/${file.replace(/\.md$/, '')}`),
  )
  .sort()

const slugToPage = new Map(docPages.map(page => [page.split('/')[1]!, page]))

describe('skills docs contract', () => {
  test('every bundled skill has a docs page', () => {
    const missing = skillNames.filter(name => !slugToPage.has(name.replace(/^stacks-/, '')))
    expect(missing).toEqual([])
  })

  test('every docs page describes a bundled skill', () => {
    const slugs = new Set(skillNames.map(name => name.replace(/^stacks-/, '')))
    const orphans = docPages.filter(page => !slugs.has(page.split('/')[1]!))
    expect(orphans).toEqual([])
  })

  test('each page names its skill and links back to the source', () => {
    const failures: string[] = []

    for (const name of skillNames) {
      const page = slugToPage.get(name.replace(/^stacks-/, ''))!
      const body = readFileSync(join(DOCS_DIR, `${page}.md`), 'utf8')

      if (!body.includes(`\`${name}\``))
        failures.push(`${page}: does not name ${name}`)
      if (!body.includes(`${name}/SKILL.md`))
        failures.push(`${page}: no link back to the SKILL.md`)
      if (!body.startsWith('---\ntitle: '))
        failures.push(`${page}: missing docs frontmatter`)
    }

    expect(failures).toEqual([])
  })

  test('each page reports the invocation the skill actually declares', () => {
    const failures: string[] = []

    for (const name of skillNames) {
      const skill = readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8')
      const page = slugToPage.get(name.replace(/^stacks-/, ''))!
      const body = readFileSync(join(DOCS_DIR, `${page}.md`), 'utf8')

      const userInvoked = /^disable-model-invocation:\s*true\s*$/m.test(skill.split('---')[1] ?? '')
      const claimed = body.includes('· user-invoked')

      if (userInvoked !== claimed)
        failures.push(`${page}: skill is ${userInvoked ? 'user' : 'model'}-invoked, page says otherwise`)
    }

    expect(failures).toEqual([])
  })

  test('every skills page has frontmatter a YAML parser accepts', () => {
    // A colon in an unquoted scalar is the trap this catches: the site still
    // builds, but the page renders with no title and no meta description.
    const pages = [
      ...docPages.map(page => join(DOCS_DIR, `${page}.md`)),
      ...readdirSync(DOCS_DIR).filter(entry => entry.endsWith('.md')).map(entry => join(DOCS_DIR, entry)),
      resolve('docs/skills.md'),
    ]

    const failures: string[] = []

    for (const page of pages) {
      const body = readFileSync(page, 'utf8')
      const frontmatter = body.match(/^---\n([\s\S]*?)\n---\n/)

      if (!frontmatter) {
        failures.push(`${page}: no frontmatter`)
        continue
      }

      const fields = new Map<string, string>()
      for (const line of frontmatter[1]!.split('\n')) {
        const at = line.indexOf(':')
        if (at === -1)
          continue

        const key = line.slice(0, at).trim()
        const value = line.slice(at + 1).trim()
        fields.set(key, value)

        const quoted = /^(".*"|'.*')$/.test(value)
        if (!quoted && value.includes(': '))
          failures.push(`${page}: unquoted "${key}" carries a colon, which is invalid YAML`)
      }

      for (const required of ['title', 'description']) {
        if (!fields.get(required))
          failures.push(`${page}: no ${required}`)
      }
    }

    expect(failures).toEqual([])
  })

  test('the section landing pages cover every skill exactly once', () => {
    const sections = readdirSync(DOCS_DIR)
      .filter(entry => entry.endsWith('.md') && !['using.md', 'writing.md', 'flows.md'].includes(entry))
      .map(entry => entry.replace(/\.md$/, ''))

    const listed = sections.flatMap((section) => {
      const body = readFileSync(join(DOCS_DIR, `${section}.md`), 'utf8')
      return [...body.matchAll(/\]\(\/skills\/([a-z-]+\/[a-z0-9-]+)\)/g)].map(m => m[1]!)
    })

    const listedInOwnSection = listed.filter(link => docPages.includes(link))
    expect([...new Set(listedInOwnSection)].sort()).toEqual(docPages)
  })

  test('the sidebar links to every skill page', async () => {
    const cfg = (await import('../../config/docs')).default as any
    const sidebar = cfg.markdown.sidebar['/skills'] as { items: { link?: string }[] }[]

    const links = new Set(
      sidebar.flatMap(group => group.items.map(item => item.link).filter(Boolean) as string[]),
    )

    const missing = docPages.filter(page => !links.has(`/skills/${page}`))
    expect(missing).toEqual([])
  })
})
