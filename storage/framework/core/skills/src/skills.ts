import type { Skill, SkillMetadata } from './types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { appPath, frameworkPath, join } from '@stacksjs/path'

/**
 * Where skills are looked up, in precedence order.
 *
 * The framework ships its skills in `storage/framework/defaults/ai/skills`. A
 * project adds its own - or shadows a bundled one by reusing its directory
 * name - under `app/Skills`, exactly the app-overrides-defaults model the rest
 * of the framework uses.
 *
 * `buddy setup:ai` materializes the merged result into whatever directory the
 * chosen agent reads (`.claude/skills` for Claude Code), one entry per skill,
 * so a project skill wins there too.
 */
function skillSources(): string[] {
  return [
    appPath('Skills'),
    frameworkPath('defaults/ai/skills'),
  ]
}

/**
 * Resolves a skill directory to the first source that provides it.
 */
function resolveSkillDir(name: string): string | null {
  for (const source of skillSources()) {
    const dir = join(source, name)
    if (existsSync(join(dir, 'SKILL.md')))
      return dir
  }

  return null
}

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

/**
 * Every available skill name, sorted, with project skills shadowing bundled
 * ones of the same name rather than appearing twice.
 */
export function listSkills(): string[] {
  const names = new Set<string>()

  for (const source of skillSources()) {
    if (!existsSync(source))
      continue

    for (const entry of readdirSync(source)) {
      const entryPath = join(source, entry)
      if (statSync(entryPath).isDirectory() && existsSync(join(entryPath, 'SKILL.md')))
        names.add(entry)
    }
  }

  return [...names].sort()
}

export function getSkill(name: string): Skill | null {
  const skillDir = resolveSkillDir(name)

  if (!skillDir)
    return null

  const skillPath = join(skillDir, 'SKILL.md')
  const content = readFileSync(skillPath, 'utf-8')
  const { metadata, body } = parseFrontmatter(content)

  const listDir = (dir: string): string[] =>
    existsSync(join(skillDir, dir)) ? readdirSync(join(skillDir, dir)) : []

  return {
    metadata,
    instructions: body,
    path: skillPath,
    scripts: listDir('scripts'),
    references: listDir('references'),
    assets: listDir('assets'),
  }
}

export function loadSkillMetadata(name: string): SkillMetadata | null {
  const skill = getSkill(name)
  return skill?.metadata ?? null
}

/**
 * Checks a skill against the agentskills.io frontmatter rules.
 */
export function validateSkill(name: string): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  const skillDir = resolveSkillDir(name)

  if (!skillDir) {
    errors.push(`Skill not found in any source: ${skillSources().map(source => join(source, name)).join(', ')}`)
    return { valid: false, errors }
  }

  const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8')
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

/**
 * The directory the framework's own skills ship from. `buddy setup:ai` reads it;
 * nothing should write into it.
 */
export function bundledSkillsPath(): string {
  return frameworkPath('defaults/ai/skills')
}

/**
 * The directory a project puts its own skills in. Searched before
 * {@link bundledSkillsPath}, so a skill here shadows a bundled one of the same
 * name.
 */
export function projectSkillsPath(): string {
  return appPath('Skills')
}

/**
 * Resolves a skill to its directory on disk, or `null` if no source has it.
 * Exposed so `buddy setup:ai` can link/copy the winning directory per skill.
 */
export function resolveSkillPath(name: string): string | null {
  return resolveSkillDir(name)
}
