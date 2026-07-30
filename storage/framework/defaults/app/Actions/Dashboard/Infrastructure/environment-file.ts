import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { frameworkRuntimePath, projectPath } from '@stacksjs/path'

const MAX_ENV_BYTES = 1024 * 1024
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/

export interface EnvironmentFileIssue {
  line: number
  message: string
}

export interface EnvironmentFileState {
  path: '.env'
  content: string
  revision: string
  exists: boolean
  updatedAt: string | null
  backup: {
    content: string
    exists: boolean
    updatedAt: string | null
  }
}

export interface EnvironmentFileOptions {
  envPath?: string
  backupPath?: string
}

function resolvedPaths(options: EnvironmentFileOptions = {}): { envPath: string, backupPath: string } {
  return {
    envPath: options.envPath ?? projectPath('.env'),
    backupPath: options.backupPath ?? frameworkRuntimePath('dashboard/environment.backup'),
  }
}

async function optionalFile(path: string): Promise<{ content: string, exists: boolean, updatedAt: string | null }> {
  try {
    const [content, metadata] = await Promise.all([
      readFile(path, 'utf8'),
      stat(path),
    ])

    return {
      content,
      exists: true,
      updatedAt: metadata.mtime.toISOString(),
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { content: '', exists: false, updatedAt: null }
    throw error
  }
}

function revisionFor(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  )

  try {
    await writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, path)
    await chmod(path, 0o600)
  }
  finally {
    await rm(temporaryPath, { force: true })
  }
}

export function validateEnvironmentFile(content: string): EnvironmentFileIssue[] {
  const issues: EnvironmentFileIssue[] = []

  if (Buffer.byteLength(content, 'utf8') > MAX_ENV_BYTES) {
    issues.push({ line: 0, message: 'The environment file must be 1 MB or smaller.' })
    return issues
  }

  if (content.includes('\0')) {
    issues.push({ line: 0, message: 'The environment file cannot contain null bytes.' })
    return issues
  }

  const seen = new Map<string, number>()
  for (const [index, sourceLine] of content.split('\n').entries()) {
    const lineNumber = index + 1
    const line = sourceLine.trim()
    if (!line || line.startsWith('#'))
      continue

    const separator = line.indexOf('=')
    if (separator < 1) {
      issues.push({ line: lineNumber, message: 'Expected KEY=value.' })
      continue
    }

    const key = line.slice(0, separator).trim()
    if (!ENV_KEY_PATTERN.test(key)) {
      issues.push({
        line: lineNumber,
        message: 'Keys must use uppercase letters, numbers, and underscores.',
      })
      continue
    }

    const previousLine = seen.get(key)
    if (previousLine) {
      issues.push({
        line: lineNumber,
        message: `${key} is already defined on line ${previousLine}.`,
      })
      continue
    }

    seen.set(key, lineNumber)
  }

  return issues
}

export async function readEnvironmentFile(options: EnvironmentFileOptions = {}): Promise<EnvironmentFileState> {
  const paths = resolvedPaths(options)
  const [environment, backup] = await Promise.all([
    optionalFile(paths.envPath),
    optionalFile(paths.backupPath),
  ])

  return {
    path: '.env',
    content: environment.content,
    revision: revisionFor(environment.content),
    exists: environment.exists,
    updatedAt: environment.updatedAt,
    backup,
  }
}

export async function updateEnvironmentFile(
  content: string,
  expectedRevision: string,
  options: EnvironmentFileOptions = {},
): Promise<{ state?: EnvironmentFileState, issues?: EnvironmentFileIssue[], conflict?: boolean }> {
  const issues = validateEnvironmentFile(content)
  if (issues.length)
    return { issues }

  const paths = resolvedPaths(options)
  const current = await optionalFile(paths.envPath)
  if (revisionFor(current.content) !== expectedRevision)
    return { conflict: true }

  if (current.exists)
    await atomicWrite(paths.backupPath, current.content)

  await atomicWrite(paths.envPath, content)
  return { state: await readEnvironmentFile(options) }
}
