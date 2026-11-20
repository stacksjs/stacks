import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { daemonDir } from './paths'

export interface GenerationApproval {
  revision: string
  files: Record<string, string>
  incomplete?: Record<string, string>
  /** Older project runtimes deliver their own alert. */
  notify?: boolean
}

export function approvalFileName(root: string): string {
  return `${createHash('sha256').update(realpathSync(root)).digest('hex')}.json`
}

export function approvalDirectory(): string {
  return daemonDir('approvals')
}

export function approvalPath(root: string): string {
  return join(approvalDirectory(), approvalFileName(root))
}

export function readApproval(path: string): GenerationApproval | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GenerationApproval
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
}

export function writeApprovalState(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}`
  try {
    writeFileSync(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 })
    renameSync(temporary, path)
  }
  finally {
    rmSync(temporary, { force: true })
  }
}
