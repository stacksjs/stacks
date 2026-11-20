import type { GenerationTask } from '@stacksjs/actions/daemon/generation-config'
import type { GenerationFileGuard } from '@stacksjs/path'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { approvalPath, readApproval, writeApprovalState } from '@stacksjs/actions/daemon/approval-state'
import { readGenerationConfig } from '@stacksjs/actions/daemon/generation-config'
import { acquireMigrationLock } from '@stacksjs/database/migration-lock'
import { generatedChanges, generationRevision, git, gitCommand, gitRevision } from './generation-changes'

const staleApproval = 'The proposal changed. Run buddy generate:project and review the current changes again.'
const commitMessage = 'chore: regenerate Stacks artifacts'

function fingerprint(root: string, file: string): string | undefined {
  const path = join(root, file)
  const stat = lstatSync(path, { throwIfNoEntry: false })
  if (!stat)
    return
  if (!stat.isFile())
    return 'not a regular file'
  return createHash('sha256').update(`${stat.mode}:`).update(readFileSync(path)).digest('hex')
}

function branchOf(revision?: string): string | undefined {
  const branch = revision?.trim().split('\n')[1]
  return branch?.startsWith('refs/heads/') ? branch : undefined
}

/** Generation and approved commits share the proposal and its working-tree files. */
export async function withApprovalLock<T>(root: string, run: () => T | Promise<T>): Promise<T> {
  const path = approvalPath(root)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const lock = await acquireMigrationLock('sqlite', null, { sqliteLockPath: `${path}.lock` })
  try {
    return await run()
  }
  finally {
    await lock.release()
  }
}

export function prepareCommitApproval(
  root: string,
  task: GenerationTask,
  enabledTasks: GenerationTask[],
): { guard: GenerationFileGuard, finish: (success: boolean) => void } | undefined {
  const revision = generationRevision(root)
  const branch = branchOf(revision)
  if (!revision)
    return

  const path = approvalPath(root)
  const { read, eligible } = generatedChanges(root, enabledTasks, true)
  const selected = generatedChanges(root, [task], true)
  const before = read()
  const previous = readApproval(path)
  // An unrelated commit on the same branch invalidates consent, but it says
  // nothing about whether Buddy still owns an unchanged working-tree file.
  const sameBranch = branch !== undefined && branchOf(previous?.revision) === branch
  const pending = new Map(Object.entries(sameBranch ? previous?.files ?? {} : {}))
  const incomplete = new Map(Object.entries(sameBranch ? previous?.incomplete ?? {} : {}))
  const expected = new Map([...selected.writable].map(file => [file, fingerprint(root, file)]))
  const writes = new Map<string, string>()

  const guard: GenerationFileGuard = {
    beforeWrite(path) {
      const file = relative(root, path)
      if (!selected.writable.has(file))
        return // Migration SQL is append-only and created exclusively by the migration writer.
      const hash = fingerprint(root, file)
      const status = before.get(file)
      const owned = hash !== undefined && (pending.get(file) === hash || incomplete.get(file) === hash || writes.get(file) === hash)
      if (expected.get(file) !== hash || hash === 'not a regular file' || (status && !(owned && eligible(file, status)))) {
        throw new Error(`Local edits in ${file}. Resolve them before Buddy regenerates this file.`)
      }
    },
    afterWrite(path) {
      const file = relative(root, path)
      const hash = fingerprint(root, file)
      if (hash && hash !== 'not a regular file') {
        writes.set(file, hash)
        expected.set(file, hash)
      }
    },
  }

  return {
    guard,
    finish(success) {
      if (!branch || branchOf(gitRevision(root)) !== branch || JSON.stringify(readApproval(path)) !== JSON.stringify(previous))
        return

      const files: Record<string, string> = {}
      const unfinished: Record<string, string> = {}
      for (const [file, status] of [...read()].sort(([a], [b]) => a.localeCompare(b))) {
        if (!eligible(file, status))
          continue
        const hash = fingerprint(root, file)
        if (!hash || hash === 'not a regular file')
          continue
        if (writes.get(file) === hash || incomplete.get(file) === hash) {
          if (success && selected.eligible(file, status))
            files[file] = hash
          else
            unfinished[file] = hash
        }
        else if (pending.get(file) === hash) {
          files[file] = hash
        }
      }

      if (Object.keys(files).length + Object.keys(unfinished).length === 0) {
        if (previous && sameBranch)
          rmSync(path, { force: true })
        return
      }
      const proposal = { revision, files, notify: true, ...(Object.keys(unfinished).length ? { incomplete: unfinished } : {}) }
      if (JSON.stringify(proposal) !== JSON.stringify(previous))
        writeApprovalState(path, proposal)
    },
  }
}

/** Move HEAD to the reviewed tree while updating only its paths in the real index. */
function commitReviewedTree(root: string, revision: string, files: string[], tree: string, workIndex: string, validate: () => void): string {
  const [head, branch] = revision.trim().split('\n')
  if (!head || !branch?.startsWith('refs/heads/'))
    throw new Error(staleApproval)
  const ongoing = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-apply', 'rebase-merge', 'sequencer', 'BISECT_START']
  if (ongoing.some(state => existsSync(git(root, 'rev-parse', '--path-format=absolute', '--git-path', state).trim())))
    throw new Error('Finish the current Git operation before approving generated changes.')

  const index = git(root, 'rev-parse', '--path-format=absolute', '--git-path', 'index').trim()
  const indexLock = `${index}.lock`
  const fd = openSync(indexLock, 'wx', lstatSync(index).mode & 0o777)
  let installed = false
  try {
    validate()
    writeFileSync(workIndex, readFileSync(index))
    const entries = git(root, 'ls-tree', '-rz', tree, '--', ...files)
    gitCommand(root, ['update-index', '-z', '--index-info'], {
      env: { ...process.env, GIT_INDEX_FILE: workIndex },
      input: entries,
    })
    const sign = git(root, 'config', '--type=bool', '--default=false', '--get', 'commit.gpgSign').trim() === 'true'
    const commit = git(root, 'commit-tree', tree, '-p', head, '-m', commitMessage, ...(sign ? ['-S'] : [])).trim()
    writeFileSync(fd, readFileSync(workIndex))
    fsyncSync(fd)
    validate()
    git(root, 'update-ref', '-m', `commit: ${commitMessage}`, branch, commit, head)
    renameSync(indexLock, index)
    installed = true
    return commit
  }
  finally {
    closeSync(fd)
    if (!installed)
      rmSync(indexLock, { force: true })
  }
}

export async function reviewGeneratedCommit(
  root: string,
  review: (diff: string) => Promise<boolean>,
): Promise<string | 'empty' | 'pending'> {
  const config = readGenerationConfig(root)
  if (!config?.commitApproval)
    throw new Error('Enable generation.commitApproval in config/buddy.json to review generated commits.')

  const path = approvalPath(root)
  const proposal = readApproval(path)
  if (!proposal || Object.keys(proposal.files).length === 0)
    return 'empty'

  const { read, eligible } = generatedChanges(root, config.tasks, true)
  const files = Object.keys(proposal.files)
  const validate = () => {
    const latest = readGenerationConfig(root)
    if (!latest?.commitApproval || latest.tasks.join() !== config.tasks.join()
      || gitRevision(root) !== proposal.revision || !proposal.revision.includes('\nrefs/heads/')
      || JSON.stringify(readApproval(path)) !== JSON.stringify(proposal))
      throw new Error(staleApproval)

    const status = read()
    for (const file of files) {
      const state = status.get(file)
      if (!state || !eligible(file, state) || fingerprint(root, file) !== proposal.files[file])
        throw new Error(staleApproval)
    }
  }

  const workspace = mkdtempSync(join(dirname(path), 'review-'))
  try {
    const previewIndex = join(workspace, 'preview-index')
    const preview = (...args: string[]) => gitCommand(root, args, { env: { ...process.env, GIT_INDEX_FILE: previewIndex } })
    validate()
    const [head] = proposal.revision.split('\n')
    preview('read-tree', head!)
    preview('add', '--force', '--', ...files)
    const tree = preview('write-tree').trim()
    const diff = git(root, 'diff', '--binary', '--no-ext-diff', '--no-textconv', '--no-color', head!, tree, '--')
    validate()
    if (!diff)
      return 'empty'
    if (!await review(diff))
      return 'pending'
    return await withApprovalLock(root, () => {
      const commit = commitReviewedTree(root, proposal.revision, files, tree, join(workspace, 'real-index'), validate)
      if (proposal.incomplete)
        writeApprovalState(path, { ...proposal, revision: gitRevision(root), files: {} })
      else
        rmSync(path, { force: true })
      return commit
    })
  }
  finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
