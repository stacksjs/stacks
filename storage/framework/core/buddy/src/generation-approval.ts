import type { GenerationTask } from '@stacksjs/actions/daemon/generation-config'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { readGenerationConfig } from '@stacksjs/actions/daemon/generation-config'
import { stacksHome } from '@stacksjs/path'
import { generatedChanges, generationRevision, git, gitCommand, gitRevision } from './generation-changes'

interface Approval {
  revision: string
  files: Record<string, string>
}

const staleApproval = 'The proposal changed. Run buddy generate:project and review the current changes again.'
const commitMessage = 'chore: regenerate Stacks artifacts'

function approvalPath(root: string): string {
  const project = createHash('sha256').update(realpathSync(root)).digest('hex')
  return stacksHome(`buddy/approvals/${project}.json`)
}

function readApproval(path: string): Approval | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Approval
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
}

function fingerprint(root: string, file: string): string {
  const path = join(root, file)
  const stat = lstatSync(path)
  return createHash('sha256').update(`${stat.mode}:`).update(readFileSync(path)).digest('hex')
}

function notifyApproval(root: string, count: number): void {
  if (process.platform !== 'darwin')
    return

  const script = 'on run argv\ndisplay notification (item 1 of argv) with title "Buddy · Generated changes"\nend run'
  const message = `${basename(root)} has ${count} generated ${count === 1 ? 'file' : 'files'} ready for review. Run ./buddy generate:review in the project.`
  const result = spawnSync('/usr/bin/osascript', ['-e', script, message], { encoding: 'utf8', timeout: 5000 })
  if (result.status !== 0)
    console.warn(`Buddy could not deliver the desktop notification. Run ./buddy generate:review in ${root}.`)
}

export function prepareCommitApproval(
  root: string,
  tasks: GenerationTask[],
  enabledTasks: GenerationTask[],
  notify = notifyApproval,
): (() => void) | undefined {
  const revision = generationRevision(root)
  if (!revision || !revision.includes('\nrefs/heads/'))
    return

  const path = approvalPath(root)
  const { read, eligible } = generatedChanges(root, enabledTasks, true)
  const { eligible: selected } = generatedChanges(root, tasks, true)
  const before = read()
  const previous = readApproval(path)
  const owned = new Map(Object.entries(previous?.revision === revision ? previous.files : {}))
  const carried = new Set([...owned].filter(([file, hash]) =>
    before.has(file) && eligible(file, before.get(file)!) && fingerprint(root, file) === hash,
  ).map(([file]) => file))

  return () => {
    const current = readApproval(path)
    if (gitRevision(root) !== revision || JSON.stringify(current) !== JSON.stringify(previous))
      return

    const files = new Map<string, string>()
    for (const [file, status] of [...read()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!eligible(file, status) || (before.has(file) && !carried.has(file)))
        continue
      const hash = fingerprint(root, file)
      // A run can refresh a subset. Preserve other still-valid proposal entries.
      if (owned.get(file) === hash || selected(file, status))
        files.set(file, hash)
    }
    const proposal: Approval = { revision, files: Object.fromEntries(files) }
    if (JSON.stringify(proposal) === JSON.stringify(previous) || (files.size === 0 && !previous))
      return
    if (files.size === 0) {
      rmSync(path, { force: true })
      return
    }

    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    const temp = `${path}.${randomUUID()}`
    try {
      writeFileSync(temp, JSON.stringify(proposal), { flag: 'wx', mode: 0o600 })
      renameSync(temp, path)
    }
    finally {
      rmSync(temp, { force: true })
    }
    notify(root, files.size)
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
    const commit = commitReviewedTree(root, proposal.revision, files, tree, join(workspace, 'real-index'), validate)
    if (JSON.stringify(readApproval(path)) === JSON.stringify(proposal))
      rmSync(path, { force: true })
    return commit
  }
  finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
