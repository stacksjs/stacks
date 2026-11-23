/**
 * What the home page claims beyond the feature list, and the three places
 * the site describes itself to something that is not a browser.
 *
 * The questions are rendered as a section and as FAQPage structured data,
 * the summary is quoted in /llms.txt, and the sitemap is the list of pages a
 * crawler is told about. Each of those is derived from the same data, and
 * each is a place the site can go on saying something after it has stopped
 * being true. These tests are what notices.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import app from '../../config/app'
import { comparisons } from '../../resources/data/comparisons'
import { features } from '../../resources/data/features'
import { faqs, showcase } from '../../resources/data/home'
import { llmsTxt } from '../../resources/data/llms'
import { breadcrumbJsonLd } from '../../resources/data/schema'
import { useCases } from '../../resources/data/use-cases'

const root = join(import.meta.dir, '../..')
const home = readFileSync(join(root, 'resources/views/index.stx'), 'utf8')

/** Every path the site serves under its three dynamic routes. */
const pages = new Set([
  '/features',
  '/use-cases',
  '/compare',
  ...features.map(feature => `/features/${feature.slug}`),
  ...useCases.map(useCase => `/use-cases/${useCase.slug}`),
  ...comparisons.map(comparison => `/compare/${comparison.slug}`),
])

describe('the products in production', () => {
  test('each one is a distinct, secure link to the host it names', () => {
    expect(showcase.length).toBeGreaterThan(0)
    expect(new Set(showcase.map(product => product.url)).size).toBe(showcase.length)

    for (const product of showcase) {
      expect(product.url).toBe(`https://${product.host}`)
      expect(product.icon).toMatch(/^i-hugeicons-[a-z0-9-]+$/)
    }
  })

  test('the section says how many there are, and is right', () => {
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
    expect(home).toContain(`${words[showcase.length]} products in production`)
  })

  test('the answer that names them names the same ones', () => {
    const answer = faqs.find(faq => faq.question.includes('production'))
    expect(answer).toBeDefined()

    for (const product of showcase)
      expect(answer!.answer).toContain(product.name)
  })
})

describe('the questions', () => {
  test('the first one defines the product in its opening words', () => {
    // /llms.txt quotes this answer as the site's summary, and an answer
    // engine lifts the first sentence of whatever it finds.
    expect(faqs[0]!.question).toBe('What is Stacks?')
    expect(faqs[0]!.answer.startsWith('Stacks is a ')).toBe(true)
  })

  for (const faq of faqs) {
    test(`"${faq.question}" stands on its own`, () => {
      expect(faq.question.endsWith('?')).toBe(true)
      // Quoted alone, an answer still has to say what it is about.
      expect(faq.answer).toContain('Stacks')
      expect(faq.answer.length).toBeLessThan(520)
      expect(`${faq.question}${faq.answer}`).not.toMatch(/[\u2013\u2014]/)
    })

    if (faq.link && !faq.link.native) {
      test(`"${faq.question}" links to a page that exists`, () => {
        expect(pages.has(faq.link!.url)).toBe(true)
      })
    }
  }

  test('the structured data is built from the list, not written beside it', () => {
    expect(home).toContain('\'@type\': \'FAQPage\'')
    expect(home).toContain('mainEntity: faqs.map(')
    expect(home).toContain('@foreach (homeFaqs as faq)')
  })
})

describe('/llms.txt', () => {
  const file = readFileSync(join(root, 'public/llms.txt'), 'utf8')

  test('is what the data says today', () => {
    // Regenerate with:
    //   bun -e "import { llmsTxt } from './resources/data/llms'; await Bun.write('public/llms.txt', llmsTxt())"
    expect(file).toBe(llmsTxt())
  })

  test('opens with the title and the site\'s own summary', () => {
    expect(file.startsWith(`# Stacks\n\n> ${faqs[0]!.answer}\n`)).toBe(true)
  })

  test('lists every feature, use case, and comparison page', () => {
    for (const path of pages) {
      if (path.split('/').length > 2)
        expect(file).toContain(`(https://stacksjs.com${path})`)
    }
  })
})

describe('the sitemap', () => {
  test('is told about every page the three dynamic routes serve', async () => {
    const sitemap = app.seo?.sitemap
    expect(sitemap).toBeTruthy()

    const entries = sitemap && sitemap.entries ? await sitemap.entries() : []
    const listed = entries.map(entry => (typeof entry === 'string' ? entry : entry.loc))
    const expected = [...pages].filter(path => path.split('/').length > 2)

    // A views scan cannot see these: each is one `[slug].stx` file. Before
    // this they were served, linked from every page, and absent from the
    // sitemap.
    expect(listed.sort()).toEqual(expected.sort())
  })
})

describe('breadcrumb structured data', () => {
  test('is the trail in order, with absolute urls', () => {
    const data = JSON.parse(breadcrumbJsonLd([{ name: 'Features', path: '/features' }, { name: 'Auth', path: '/features/auth' }]))

    expect(data['@type']).toBe('BreadcrumbList')
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', 'position': 1, 'name': 'Features', 'item': 'https://stacksjs.com/features' },
      { '@type': 'ListItem', 'position': 2, 'name': 'Auth', 'item': 'https://stacksjs.com/features/auth' },
    ])
  })

  // The markup may only describe what the page shows, so each view that
  // declares the data also has to print the trail it describes.
  for (const [view, hub] of [['features', 'Features'], ['use-cases', 'Use cases'], ['compare', 'Compare']] as const) {
    test(`/${view}/:slug declares the trail it prints`, () => {
      const source = readFileSync(join(root, `resources/views/${view}/[slug].stx`), 'utf8')

      expect(source).toContain(`breadcrumbJsonLd([{ name: '${hub}', path: '/${view}' }`)
      expect(source).toContain('class="breadcrumb"')
      expect(source).toContain(`<a href="/${view}">${hub}</a>`)
    })
  }
})
