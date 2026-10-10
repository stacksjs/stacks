import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { getSkill, listSkills, validateSkill } from '@stacksjs/skills'

const ai = resolve('storage/framework/defaults/ai')
const manifest = JSON.parse(readFileSync(join(ai, 'skills/stacks-flow/upstream-skills.json'), 'utf8')) as {
  schemaVersion: number
  sources: Array<{
    repository: string
    revision: string
    expectedSkills: number
    skills: Array<{ source: string, path: string, target: string, disposition: string, sha256: string }>
  }>
}
const targets = [...new Set(manifest.sources.flatMap(source => source.skills.map(skill => skill.target)))]

describe('upstream skill ports', () => {
  test('accounts for both complete reviewed catalogs at fixed revisions', () => {
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.sources.map(source => [source.repository, source.skills.length])).toEqual([
      ['coreyhaines31/marketingskills', 50],
      ['mattpocock/skills', 38],
    ])

    for (const source of manifest.sources) {
      expect(source.revision).toMatch(/^[a-f0-9]{40}$/)
      expect(source.skills.length).toBe(source.expectedSkills)
      expect(new Set(source.skills.map(skill => skill.path)).size).toBe(source.skills.length)
      for (const skill of source.skills) {
        expect(skill.sha256).toMatch(/^[a-f0-9]{64}$/)
        expect(['ported', 'refreshed', 'native-substitute']).toContain(skill.disposition)
      }
    }
  })

  test('makes every mapped skill discoverable with its source and MIT notice', () => {
    const available = listSkills()
    for (const name of targets) {
      expect(available).toContain(name)
      expect(validateSkill(name).errors).toEqual([])
      expect(getSkill(name)).not.toBeNull()
      expect(readFileSync(join(ai, 'skills', name, 'LICENSE'), 'utf8')).toContain('MIT License')
      expect(readFileSync(join(ai, 'skills', name, 'NOTICE.md'), 'utf8')).toContain('Source')
    }
  })

  test('preserves representative marketing resources and distinct API skill names', () => {
    expect(getSkill('stacks-marketing-analytics')!.path).not.toBe(getSkill('stacks-analytics')!.path)
    expect(getSkill('stacks-marketing-sms')!.path).not.toBe(getSkill('stacks-sms')!.path)
    for (const path of [
      'stacks-marketing/CATALOG.md',
      'stacks-marketing/WORKFLOW.md',
      'stacks-marketing-ad-creative/assets/creative-review-template.html',
      'stacks-marketing-council/references/advisors/seth-godin.md',
    ]) {
      expect(existsSync(join(ai, 'skills', path))).toBe(true)
    }
  })

  test('keeps local reference links complete and imported skills free of Python files', () => {
    const missing: string[] = []
    const python: string[] = []
    for (const name of [...targets, 'stacks-marketing']) {
      const directory = join(ai, 'skills', name)
      for (const file of new Bun.Glob('**/*').scanSync({ cwd: directory, onlyFiles: true })) {
        if (file.endsWith('.py'))
          python.push(`${name}/${file}`)
        if (!file.endsWith('.md'))
          continue

        // Example templates inside fenced code deliberately contain placeholder links.
        const body = readFileSync(join(directory, file), 'utf8').replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
        for (const [, target] of body.matchAll(/\]\(([^)]+)\)/g)) {
          if (!target || /^(https?:|mailto:|#|data:|\/)|[<>$]/.test(target))
            continue
          if (!existsSync(resolve(directory, dirname(file), target.split('#')[0]!)))
            missing.push(`${name}/${file}: ${target}`)
        }
      }
    }
    expect(missing).toEqual([])
    expect(python).toEqual([])
  })
})
