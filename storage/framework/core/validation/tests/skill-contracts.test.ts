import { expect, test } from 'bun:test'

test('authoritative validation guidance preserves the tested boundary contracts', async () => {
  const skill = await Bun.file(new URL('../../../defaults/ai/skills/stacks-validation/SKILL.md', import.meta.url)).text()
  expect(skill).not.toMatch(/helpers return allowed when the database cannot be queried|reporter is shared process state|Sets custom error messages via `MessageProvider`|skips attributes with default values unless/i)
  for (const contract of ['propagate query failures', 'async-local', 'supplied invalid', 'without executing predicates again']) expect(skill).toContain(contract)
  for (const evidence of ['conditional-boundaries.test.ts', 'input-contracts.test.ts', 'boundary-e2e.test.ts', 'async-rules.test.ts']) {
    expect(skill).toContain(evidence)
    expect(await Bun.file(new URL(evidence, import.meta.url)).exists()).toBe(true)
  }
})
