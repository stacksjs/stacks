import { join, resolve } from '@stacksjs/path'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import type { Skill, SkillMetadata } from './types'

const SKILLS_DIR = resolve(join(import.meta.dir, '..', '..', '..', '..', '..', '.claude', 'skills'))

function parseFrontmatter(content: string): { metadata: SkillMetadata, body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!match) {
    return {
      metadata: { name: '', description: '' },
      body: content,
    }
  }

  const [, frontmatterStr, body] = match
  const metadata: Record<string, unknown> = {}

  for (const line of (frontmatterStr ?? '').split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1)
      continue
    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()
    metadata[key] = value
  }

  return { metadata: metadata as unknown as SkillMetadata, body: body ?? '' }
}

export function listSkills(): string[] {
  if (!existsSync(SKILLS_DIR))
    return []

  return readdirSync(SKILLS_DIR).filter((entry) => {
    const entryPath = join(SKILLS_DIR, entry)
    return statSync(entryPath).isDirectory() && existsSync(join(entryPath, 'SKILL.md'))
  })
}

export function getSkill(name: string): Skill | null {
  const skillPath = join(SKILLS_DIR, name, 'SKILL.md')

  if (!existsSync(skillPath))
    return null

  const content = readFileSync(skillPath, 'utf-8')
  const { metadata, body } = parseFrontmatter(content)
  const skillDir = join(SKILLS_DIR, name)

  const scripts = existsSync(join(skillDir, 'scripts'))
    ? readdirSync(join(skillDir, 'scripts'))
    : []

  const references = existsSync(join(skillDir, 'references'))
    ? readdirSync(join(skillDir, 'references'))
    : []

  const assets = existsSync(join(skillDir, 'assets'))
    ? readdirSync(join(skillDir, 'assets'))
    : []

  return {
    metadata,
    instructions: body,
    path: skillPath,
    scripts,
    references,
    assets,
  }
}

export function loadSkillMetadata(name: string): SkillMetadata | null {
  const skill = getSkill(name)
  return skill?.metadata ?? null
}

export function validateSkill(name: string): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  const skillDir = join(SKILLS_DIR, name)

  if (!existsSync(skillDir)) {
    errors.push(`Skill directory not found: ${skillDir}`)
    return { valid: false, errors }
  }

  const skillPath = join(skillDir, 'SKILL.md')
  if (!existsSync(skillPath)) {
    errors.push(`SKILL.md not found in ${skillDir}`)
    return { valid: false, errors }
  }

  const content = readFileSync(skillPath, 'utf-8')
  const { metadata } = parseFrontmatter(content)

  if (!metadata.name) {
    errors.push('Missing required field: name')
  }
  else {
    if (metadata.name.length > 64)
      errors.push('Name must be 1-64 characters')
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(metadata.name))
      errors.push('Name must be lowercase letters, numbers, and hyphens only')
    if (metadata.name !== name)
      errors.push(`Name "${metadata.name}" must match directory name "${name}"`)
  }

  if (!metadata.description) {
    errors.push('Missing required field: description')
  }
  else if (metadata.description.length > 1024) {
    errors.push('Description must be 1-1024 characters')
  }

  return { valid: errors.length === 0, errors }
}
