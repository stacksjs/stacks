import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TemporaryWorkspaceJournal } from '../../src/temporary-workspaces'

const roots: string[] = []
export function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workspace-journal-'))
  roots.push(root)
  const options = { directory: join(root, 'journal'), temporaryRoot: root, prefix: 'job-' }
  return { root, options, journal: new TemporaryWorkspaceJournal(options) }
}
export function cleanup() {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
}
