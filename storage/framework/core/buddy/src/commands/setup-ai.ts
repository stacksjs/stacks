import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { dim, green, log, yellow } from '@stacksjs/cli'
import { frameworkPath, join, projectPath, relative } from '@stacksjs/path'
import { listSkills, resolveSkillPath } from '@stacksjs/skills'

/**
 * `buddy setup:ai` - wires a project up for an AI coding agent.
 *
 * The framework keeps its agent material in `storage/framework/defaults/ai`.
 * Nothing there is read at runtime; this command materializes it into whatever
 * files and directories the chosen agent actually looks for.
 *
 * Only `AGENTS.md` is committed - it is shared guidance every agent reads, and
 * it belongs in review. The generated per-agent directories are gitignored,
 * because which agent a developer uses is a personal choice.
 */

export type AiProvider = 'claude' | 'codex' | 'cursor' | 'copilot' | 'gemini'

export interface AiProviderDefinition {
  /** Value accepted on the command line. */
  id: AiProvider
  /** Shown in the interactive picker. */
  label: string
  /** What the agent will read once setup finishes. */
  reads: string[]
}

/**
 * The agents we know how to set up, and the project files each one reads.
 *
 * Every entry reflects that agent's documented convention: Claude Code reads
 * `CLAUDE.md` and `.claude/skills`, Codex CLI reads `AGENTS.md` natively, Cursor
 * reads `.cursor/rules/*.mdc`, Copilot reads `.github/copilot-instructions.md`,
 * and Gemini CLI reads `GEMINI.md`.
 */
export const AI_PROVIDERS: readonly AiProviderDefinition[] = [
  { id: 'claude', label: 'Claude Code', reads: ['AGENTS.md', 'CLAUDE.md', '.claude/skills', '.claude/launch.json'] },
  { id: 'codex', label: 'OpenAI Codex CLI', reads: ['AGENTS.md'] },
  { id: 'cursor', label: 'Cursor', reads: ['AGENTS.md', '.cursor/rules'] },
  { id: 'copilot', label: 'GitHub Copilot', reads: ['AGENTS.md', '.github/copilot-instructions.md'] },
  { id: 'gemini', label: 'Gemini CLI', reads: ['AGENTS.md', 'GEMINI.md'] },
]

export function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDERS.some(provider => provider.id === value)
}

export interface SetupAiOptions {
  /** Copy files instead of symlinking them, so they can be edited per project. */
  copy?: boolean
  /** Replace files that already exist. Without it, existing files are left alone. */
  force?: boolean
}

export interface SetupAiResult {
  created: string[]
  skipped: string[]
}

/**
 * Writes `path` as a symlink to `target`, or as a copy when `copy` is set.
 *
 * Returns false when something is already there and `force` was not passed -
 * a hand-edited `CLAUDE.md` or a customized skill should never be clobbered by
 * a setup command.
 */
export function materialize(target: string, path: string, options: SetupAiOptions): boolean {
  const existing = lstatSync(path, { throwIfNoEntry: false })

  if (existing) {
    // Symlinks are ours: refresh them so an upgrade or a rename re-points them.
    // A real file or directory is the developer's - only --force touches it.
    if (!existing.isSymbolicLink() && !options.force)
      return false

    rmSync(path, { recursive: true, force: true })
  }

  mkdirSync(join(path, '..'), { recursive: true })

  if (options.copy) {
    cpSync(target, path, { recursive: true })
  }
  else {
    // Relative, so the link survives the project being moved or checked out at
    // a different path - `CLAUDE.md -> AGENTS.md` is committed, and an absolute
    // target would break it for everyone else.
    symlinkSync(relative(join(path, '..'), target), path, process.platform === 'win32' ? 'junction' : 'dir')
  }

  return true
}

/**
 * Copies a template file into the project, leaving any existing file alone
 * unless `--force` was passed.
 */
function materializeFile(source: string, path: string, options: SetupAiOptions): boolean {
  if (existsSync(path) && !options.force)
    return false

  mkdirSync(join(path, '..'), { recursive: true })
  cpSync(source, path, { recursive: true, force: true })

  return true
}

/**
 * Fills the agent's skills directory with one entry per skill.
 *
 * Per-skill rather than a single link on the whole directory, so a project skill
 * in `app/Skills` can shadow a bundled one of the same name and still show up in
 * the agent's directory.
 */
function installSkills(destination: string, options: SetupAiOptions): { installed: number, skipped: number } {
  const names = listSkills()
  let installed = 0
  let skipped = 0

  mkdirSync(destination, { recursive: true })

  // Sweep dangling links from skills that no longer exist (a renamed skill, or
  // one dropped by a framework upgrade). Only links we could have made
  // ourselves - never a real directory somebody put there.
  for (const entry of readdirSync(destination)) {
    const path = join(destination, entry)
    const stats = lstatSync(path, { throwIfNoEntry: false })
    if (stats?.isSymbolicLink() && !existsSync(path))
      rmSync(path, { force: true })
  }

  for (const name of names) {
    const source = resolveSkillPath(name)
    if (!source)
      continue

    if (materialize(source, join(destination, name), options))
      installed++
    else
      skipped++
  }

  return { installed, skipped }
}

/**
 * Sets a project up for one AI coding agent. Idempotent: re-running it after a
 * framework upgrade refreshes what it owns and leaves everything else alone.
 */
export function setupAiProvider(provider: AiProvider, options: SetupAiOptions = {}): SetupAiResult {
  const created: string[] = []
  const skipped: string[] = []
  const defaults = frameworkPath('defaults/ai')
  const rel = (path: string): string => relative(projectPath(), path)

  const record = (path: string, didCreate: boolean): void => {
    ;(didCreate ? created : skipped).push(rel(path))
  }

  // AGENTS.md first: every agent reads it, and the per-agent files below are
  // mostly pointers to it.
  //
  // Seeded only when it is missing - never with `--force`. It is authored,
  // committed content that a team edits over months; the template here is a
  // starting point, not something a setup command gets to overwrite. `--force`
  // is for the generated per-agent files below.
  const agents = projectPath('AGENTS.md')
  record(agents, materializeFile(join(defaults, 'AGENTS.md'), agents, { ...options, force: false }))

  switch (provider) {
    case 'claude': {
      // CLAUDE.md is a symlink so the two files can never drift apart.
      //
      // `force: false` regardless of what the caller asked for. `materialize`
      // refreshes an existing symlink either way, so re-pointing still works;
      // what --force would otherwise buy is deleting a REAL CLAUDE.md, and
      // that file is authored, committed content a team edits over months —
      // the same reason AGENTS.md above pins force off.
      //
      // This mattered: `buddy upgrade` runs the AI setup with --force so the
      // generated per-agent files get refreshed, and a project that had
      // written its own CLAUDE.md instead of AGENTS.md lost the whole file to
      // a symlink, inside an upgrade whose output said "AGENTS.md (already
      // present, left alone)". Converting a real CLAUDE.md into the symlink
      // layout is a deliberate act: delete it and re-run, and the note below
      // says so.
      const claudeMd = projectPath('CLAUDE.md')
      const linked = materialize(agents, claudeMd, { ...options, copy: false, force: false })
      record(claudeMd, linked)
      if (!linked && existsSync(claudeMd) && !lstatSync(claudeMd, { throwIfNoEntry: false })?.isSymbolicLink())
        log.info(`  · ${rel(claudeMd)} is a real file, so it is left as-is. Move its content into AGENTS.md and delete it to have both agents read one file.`)

      const launch = projectPath('.claude/launch.json')
      record(launch, materializeFile(join(defaults, 'claude/launch.json'), launch, options))

      const skillsDir = projectPath('.claude/skills')
      const { installed, skipped: untouched } = installSkills(skillsDir, options)
      if (installed > 0)
        created.push(`${rel(skillsDir)} (${installed} skills)`)
      if (untouched > 0)
        skipped.push(`${rel(skillsDir)} (${untouched} skills)`)
      break
    }

    case 'codex':
      // Codex CLI reads AGENTS.md directly. Nothing else to write.
      break

    case 'cursor': {
      const rules = projectPath('.cursor/rules')
      record(rules, materialize(frameworkPath('defaults/ide/cursor/rules'), rules, options))
      break
    }

    case 'copilot': {
      const instructions = projectPath('.github/copilot-instructions.md')
      if (existsSync(instructions) && !options.force) {
        skipped.push(rel(instructions))
      }
      else {
        mkdirSync(projectPath('.github'), { recursive: true })
        writeFileSync(instructions, pointerFile('AGENTS.md'), 'utf8')
        created.push(rel(instructions))
      }
      break
    }

    case 'gemini': {
      const geminiMd = projectPath('GEMINI.md')
      record(geminiMd, materialize(agents, geminiMd, { ...options, copy: false }))
      break
    }
  }

  return { created, skipped }
}

/**
 * Body for agents that read a fixed filename but have no symlink-friendly
 * convention - point them at AGENTS.md instead of duplicating it.
 */
function pointerFile(target: string): string {
  return [
    '# Project instructions',
    '',
    `This project keeps its agent guidance in [\`${target}\`](../${target}), so every`,
    'agent works from the same rules. Read that file.',
    '',
    `Regenerate this pointer with \`buddy setup:ai copilot --force\`.`,
    '',
  ].join('\n')
}

/**
 * Renders the result of a setup run.
 */
export function reportAiSetup(provider: AiProviderDefinition, result: SetupAiResult): void {
  for (const path of result.created)
    log.info(`  ${green('+')} ${path}`)

  for (const path of result.skipped)
    log.info(`  ${yellow('·')} ${path} ${dim('(already present, left alone)')}`)

  if (result.created.length === 0)
    log.info(dim('  Nothing to do - re-run with --force to overwrite.'))

  log.success(`${provider.label} is set up. It reads: ${provider.reads.join(', ')}`)
}
