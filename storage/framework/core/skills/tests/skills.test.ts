import { describe, expect, test } from 'bun:test'

describe('skills module exports', () => {
  test('listSkills is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.listSkills).toBe('function')
  })

  test('getSkill is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.getSkill).toBe('function')
  })

  test('validateSkill is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.validateSkill).toBe('function')
  })

  test('loadSkillMetadata is exported and is a function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.loadSkillMetadata).toBe('function')
  })
})

describe('listSkills', () => {
  test('returns an array', async () => {
    const { listSkills } = await import('../src/index')
    const result = listSkills()
    expect(Array.isArray(result)).toBe(true)
  })

  test('returns the skills bundled with the framework', async () => {
    const { listSkills } = await import('../src/index')
    const skills = listSkills()

    expect(skills.length).toBeGreaterThan(0)
    expect(skills.every(name => typeof name === 'string')).toBe(true)
    expect(skills).toContain('stacks-orm')
  })

  test('returns names sorted and free of duplicates', async () => {
    const { listSkills } = await import('../src/index')
    const skills = listSkills()

    expect(skills).toEqual([...skills].sort())
    expect(new Set(skills).size).toBe(skills.length)
  })
})

describe('skill sources', () => {
  test('bundled skills ship from storage/framework/defaults/ai/skills', async () => {
    const { bundledSkillsPath } = await import('../src/index')
    expect(bundledSkillsPath()).toEndWith('/storage/framework/defaults/ai/skills')
  })

  test('project skills are read from app/Skills', async () => {
    const { projectSkillsPath } = await import('../src/index')
    expect(projectSkillsPath()).toEndWith('/app/Skills')
  })

  test('resolveSkillPath points at a real directory for a bundled skill', async () => {
    const { bundledSkillsPath, resolveSkillPath } = await import('../src/index')
    expect(resolveSkillPath('stacks-orm')).toBe(`${bundledSkillsPath()}/stacks-orm`)
  })

  test('resolveSkillPath returns null for an unknown skill', async () => {
    const { resolveSkillPath } = await import('../src/index')
    expect(resolveSkillPath('definitely-not-a-skill')).toBeNull()
  })
})

describe('getSkill', () => {
  test('returns null for nonexistent skill', async () => {
    const { getSkill } = await import('../src/index')
    const result = getSkill('nonexistent-skill-that-does-not-exist')
    expect(result).toBeNull()
  })

  test('returns skill object for existing skill', async () => {
    const { listSkills, getSkill } = await import('../src/index')
    const skills = listSkills()
    if (skills.length > 0) {
      const skill = getSkill(skills[0]!)
      expect(skill).not.toBeNull()
      expect(skill!.metadata).toBeDefined()
      expect(skill!.instructions).toBeDefined()
      expect(skill!.path).toBeDefined()
      expect(typeof skill!.path).toBe('string')
    }
  })
})

describe('validateSkill', () => {
  test('returns errors for nonexistent skill', async () => {
    const { validateSkill } = await import('../src/index')
    const result = validateSkill('nonexistent-skill-xyz')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('not found')
  })

  test('returns valid:boolean and errors:string[]', async () => {
    const { validateSkill } = await import('../src/index')
    const result = validateSkill('test')
    expect(typeof result.valid).toBe('boolean')
    expect(Array.isArray(result.errors)).toBe(true)
  })

  test('every bundled skill passes validation', async () => {
    const { listSkills, validateSkill } = await import('../src/index')
    const failures = listSkills()
      .map(name => ({ name, ...validateSkill(name) }))
      .filter(result => !result.valid)

    expect(failures.map(f => `${f.name}: ${f.errors.join('; ')}`)).toEqual([])
  })
})

describe('loadSkillMetadata', () => {
  test('returns null for nonexistent skill', async () => {
    const { loadSkillMetadata } = await import('../src/index')
    const result = loadSkillMetadata('nonexistent-skill-xyz')
    expect(result).toBeNull()
  })
})

describe('skills types', () => {
  test('Skill type can be referenced from module', async () => {
    const mod = await import('../src/index')
    // The module exports type-only things like Skill, SkillMetadata, SkillManifest
    // Verify the module is importable (types are compile-time only)
    expect(mod).toBeDefined()
  })
})
