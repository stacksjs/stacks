import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditLighthouse, basicAuditOrigin, formatLighthouseResult, lighthouseScores, lighthouseTargets } from '../src/lighthouse'

const categories = { performance: { score: 1 }, accessibility: { score: 1 }, 'best-practices': { score: 1 }, seo: { score: 1 } }

test('protected audits scope credentials to one secure origin', () => {
  expect(basicAuditOrigin('https://preview.test', ['/', 'https://preview.test/pricing'])).toBe('https://preview.test')
  expect(basicAuditOrigin('http://localhost:3000', ['/'])).toBe('http://localhost:3000')
  expect(() => basicAuditOrigin('http://preview.test', ['/'])).toThrow('require HTTPS')
  expect(() => basicAuditOrigin('https://preview.test', ['/', 'https://other.test/'])).toThrow('share --base origin')
})

test('all four categories are required, including explicit zeroes and runtime failures', () => {
  expect(lighthouseScores({ categories })).toEqual({ performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 })
  expect(lighthouseScores({ categories: { ...categories, performance: { score: 0 } } }).performance).toBe(0)
  for (const score of [null, undefined, Number.NaN, 2, -1, '1'])
    expect(() => lighthouseScores({ categories: { ...categories, seo: { score } } })).toThrow('no valid seo score')
  expect(() => lighthouseScores({ categories, runtimeError: { message: 'Navigation failed' } })).toThrow('Navigation failed')
})

test('a production sitemap selects distinct preview paths without changing query values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lighthouse-'))
  try {
    const sitemap = join(directory, 'sitemap.xml')
    await writeFile(sitemap, '<urlset><url><loc>https://production.test/</loc></url><url><loc>https://production.test/races?a=1&amp;b=2</loc></url></urlset>')
    expect(await lighthouseTargets({ url: '/#top,/', sitemap, base: 'http://localhost:3942' })).toEqual(['http://localhost:3942/', 'http://localhost:3942/races?a=1&b=2'])
    await writeFile(sitemap, '<urlset/>')
    await expect(lighthouseTargets({ sitemap })).rejects.toThrow('no page URLs')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
  await expect(lighthouseTargets({ url: 'file:///etc/passwd' })).rejects.toThrow('HTTP or HTTPS')
  await expect(lighthouseTargets({ url: 'https://user:password@example.test' })).rejects.toThrow('embedded credentials')
  await expect(lighthouseTargets({})).rejects.toThrow('Pass --url or --sitemap')
})

test('runs standard mobile and desktop profiles, retains failures and writes portable reports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lighthouse-'))
  const calls: string[][] = []
  try {
    const results = await auditLighthouse({ urls: ['https://example.test/a-b', 'https://example.test/a/b'], outputDir: join(directory, 'new'), minimum: 100 }, async (args) => {
      calls.push(args)
      const output = args.find(arg => arg.startsWith('--output-path='))!.slice('--output-path='.length)
      await writeFile(`${output}.report.json`, JSON.stringify({ finalUrl: args[4], categories: { ...categories, performance: { score: calls.length === 1 ? .98 : 1 } }, audits: { contrast: { score: 0, title: 'Contrast' }, manual: { score: null } } }))
      await writeFile(`${output}.report.html`, '<html>Lighthouse report</html>')
      return { code: 0, stderr: '' }
    })
    expect(calls).toHaveLength(4)
    expect(calls[0]).not.toContain('--preset=desktop')
    expect(calls[1]).toContain('--preset=desktop')
    expect(calls.every(args => args.includes('--only-categories=performance,accessibility,best-practices,seo'))).toBe(true)
    expect(results.map(result => result.passed)).toEqual([false, true, true, true])
    expect(new Set(results.map(result => result.json)).size).toBe(4)
    expect(results[0]!.findings).toEqual([{ id: 'contrast', title: 'Contrast', value: undefined }])
    const summary = JSON.parse(await readFile(join(directory, 'new', 'summary.json'), 'utf8'))
    expect(summary.results).toHaveLength(4)
    expect(summary.minimum).toBe(100)
    expect(summary.status).toBe('complete')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('rejects invalid thresholds before invoking Lighthouse and surfaces failed collection', async () => {
  let invoked = false
  const runner = async () => { invoked = true; return { code: 1, stderr: 'Chrome unavailable' } }
  for (const minimum of [101, -1, Number.NaN])
    await expect(auditLighthouse({ urls: ['https://example.test'], outputDir: '.', minimum }, runner)).rejects.toThrow('Minimum score')
  expect(invoked).toBe(false)
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lighthouse-'))
  try {
    await writeFile(join(directory, 'summary.json'), JSON.stringify({ status: 'complete', results: [{ passed: true }] }))
    await expect(auditLighthouse({ urls: ['https://example.test'], outputDir: directory }, async (args) => {
      if (!args.includes('--preset=desktop')) return runner()
      const output = args.find(arg => arg.startsWith('--output-path='))!.slice('--output-path='.length)
      await writeFile(`${output}.report.json`, JSON.stringify({ categories }))
      return { code: 0, stderr: '' }
    })).rejects.toThrow('Chrome unavailable')
    const receipt = JSON.parse(await readFile(join(directory, 'summary.json'), 'utf8'))
    expect(receipt.status).toBe('failed')
    expect(receipt.results.map((result: { device: string }) => result.device)).toEqual(['desktop'])
    expect(receipt.failures).toEqual([{ url: 'https://example.test/', device: 'mobile', message: 'Chrome unavailable' }])
    expect(receipt.error).toContain('Chrome unavailable')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('reports the measured metric that cost the most performance points', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lighthouse-'))
  try {
    const [result] = await auditLighthouse({ urls: ['https://example.test'], outputDir: directory, device: 'desktop' }, async (args) => {
      const output = args.find(arg => arg.startsWith('--output-path='))!.slice('--output-path='.length)
      await writeFile(`${output}.report.json`, JSON.stringify({
        categories: {
          ...categories,
          performance: { score: .85, auditRefs: [{ id: 'speed-index', weight: 10 }, { id: 'cumulative-layout-shift', weight: 25 }, { id: 'first-contentful-paint', weight: 65 }, { id: 'diagnostic', weight: 0 }] },
        },
        audits: {
          'speed-index': { score: .5, title: 'Speed Index', displayValue: '1.4 s' },
          'cumulative-layout-shift': { score: .6, title: 'Cumulative Layout Shift', displayValue: '0.2' },
          'first-contentful-paint': { score: 1, title: 'First Contentful Paint' },
          'diagnostic': { score: 0, title: 'Unweighted finding' },
        },
      }))
      return { code: 0, stderr: '' }
    })
    expect(result?.largestPerformanceLoss).toEqual({ id: 'cumulative-layout-shift', title: 'Cumulative Layout Shift', value: '0.2', pointsLost: 10 })
    expect(result?.lcpTraceMs).toBeUndefined()
    expect(formatLighthouseResult(result!)).toContain('Cumulative Layout Shift 0.2 cost 10.00 performance points')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('records observed LCP timings and identifies the slowest trace phase for an LCP miss', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lighthouse-'))
  try {
    const [result] = await auditLighthouse({ urls: ['https://example.test'], outputDir: directory, device: 'mobile' }, async (args) => {
      const output = args.find(arg => arg.startsWith('--output-path='))!.slice('--output-path='.length)
      await writeFile(`${output}.report.json`, JSON.stringify({
        categories: { ...categories, performance: { score: .96, auditRefs: [{ id: 'largest-contentful-paint', weight: 25 }] } },
        audits: {
          'largest-contentful-paint': { score: .84, title: 'Largest Contentful Paint', displayValue: '2.7 s' },
          'lcp-breakdown-insight': {
            details: { items: [{ items: [
              { subpart: 'timeToFirstByte', duration: 380.01 },
              { subpart: 'resourceLoadDelay', duration: 0 },
              { subpart: 'resourceLoadDuration', duration: 716.42 },
              { subpart: 'elementRenderDelay', duration: 30 },
              { subpart: 'anotherPhase', duration: 1000 },
              { subpart: 'resourceLoadDelay', duration: -1 },
            ] }] },
          },
        },
      }))
      return { code: 0, stderr: '' }
    })
    expect(result?.lcpTraceMs).toEqual({
      timeToFirstByte: 380.01,
      resourceLoadDelay: 0,
      resourceLoadDuration: 716.42,
      elementRenderDelay: 30,
    })
    expect(formatLighthouseResult(result!)).toContain('LCP trace resource download 716 ms')
    const receipt = JSON.parse(await readFile(join(directory, 'summary.json'), 'utf8'))
    expect(receipt.results[0].lcpTraceMs).toEqual(result?.lcpTraceMs)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('reports main-thread evidence for a Total Blocking Time miss without copying task URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-lighthouse-'))
  try {
    const [result] = await auditLighthouse({ urls: ['https://example.test'], outputDir: directory, device: 'mobile' }, async (args) => {
      const output = args.find(arg => arg.startsWith('--output-path='))!.slice('--output-path='.length)
      await writeFile(`${output}.report.json`, JSON.stringify({
        categories: {
          ...categories,
          performance: { score: .85, auditRefs: [{ id: 'total-blocking-time', weight: 30 }] },
        },
        environment: { benchmarkIndex: 745 },
        audits: {
          'total-blocking-time': { score: .5, title: 'Total Blocking Time', displayValue: '410 ms' },
          'long-tasks': { details: { items: [{ duration: 84 }, { duration: 295.12, url: 'https://example.test/private.js?token=fixture' }, { duration: '900' }] } },
        },
      }))
      return { code: 0, stderr: '' }
    })
    expect(result?.mainThread).toEqual({ benchmarkIndex: 745, longestTaskMs: 295.12 })
    expect(formatLighthouseResult(result!)).toContain('Longest main-thread task 295 ms | Host CPU benchmark 745')
    const summary = await readFile(join(directory, 'summary.json'), 'utf8')
    expect(JSON.parse(summary).results[0].mainThread).toEqual(result?.mainThread)
    expect(summary).not.toContain('private.js')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
