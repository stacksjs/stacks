import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { data, Evaluator, Lexer, Parser } from '@actions/expressions'

interface GitHubEvent {
  event_name: string
  ref: string
  sha: string
  run_id: number
  event: {
    head_commit?: { message: string }
    pull_request?: { number: number }
  }
}

const workflow = Bun.YAML.parse(readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8')) as {
  concurrency: { group: string, queue: string, 'cancel-in-progress': string }
}

// Exercise the committed workflow with the official runner-language evaluator.
// This proves expression values, not hosted runner capacity or CI admission.
function expression(source: string, github: GitHubEvent): data.ExpressionData {
  const context: unknown = JSON.parse(JSON.stringify({ github }), data.reviver)
  if (!(context instanceof data.Dictionary)) throw new Error('Expected a GitHub expression context')
  const tokens = new Lexer(source).lex().tokens
  return new Evaluator(new Parser(tokens, ['github'], []).parse(), context).evaluate()
}

function group(github: GitHubEvent): string {
  return workflow.concurrency.group.replace(/\$\{\{([\s\S]*?)\}\}/g, (_match, source: string) => expression(source, github).coerceString())
}

function policy(github: GitHubEvent): { queue: string, cancel: boolean } {
  const value = (field: string): data.ExpressionData => {
    const source = /^\$\{\{([\s\S]*)\}\}$/.exec(field)?.[1]
    if (!source) throw new Error('Expected a workflow concurrency expression')
    return expression(source, github)
  }
  const cancel = value(workflow.concurrency['cancel-in-progress'])
  if (!(cancel instanceof data.BooleanData)) throw new Error('Cancellation must be boolean')
  return { queue: value(workflow.concurrency.queue).coerceString(), cancel: cancel.value }
}

const release: GitHubEvent = {
  event_name: 'push', ref: 'refs/heads/main', sha: 'a'.repeat(40), run_id: 100,
  event: { head_commit: { message: 'chore: release v0.75.425' } },
}

test('a canonical release main push does not wait in the ordinary main CI group', () => {
  expect(group(release)).toBe(`ci-${'a'.repeat(40)}`)
  expect(group({ ...release, sha: 'b'.repeat(40) })).toBe(`ci-${'b'.repeat(40)}`)
  expect(group({ ...release, event: { head_commit: { message: 'fix: preserve ordinary main acceptance' } } })).toBe('ci-refs/heads/main')
})

test('release identity is its source SHA and never cancels an earlier identical-source run', () => {
  expect(group({ ...release, run_id: 101 })).toBe(`ci-${'a'.repeat(40)}`)
  expect(policy(release)).toEqual({ queue: 'max', cancel: false })
  expect(policy({ ...release, run_id: 101 })).toEqual({ queue: 'max', cancel: false })
})

test('ordinary main commits keep the full queue even when their body mentions a release', () => {
  for (const message of ['fix: an ordinary change', 'fix: a release note\n\nchore: release v0.75.425', 'docs: chore: release v0.75.425']) {
    const github = { ...release, sha: 'c'.repeat(40), event: { head_commit: { message } } }
    expect(group(github)).toBe('ci-refs/heads/main')
    expect(policy(github)).toEqual({ queue: 'max', cancel: false })
  }
})

test('release-looking pull requests retain their own replaceable single-pending group', () => {
  const github: GitHubEvent = {
    ...release, event_name: 'pull_request', ref: 'refs/pull/7/merge',
    event: { ...release.event, pull_request: { number: 7 } },
  }
  expect(group(github)).toBe('ci-7')
  expect(group({ ...github, sha: 'b'.repeat(40) })).toBe('ci-7')
  expect(group({ ...github, event: { ...github.event, pull_request: { number: 8 } } })).toBe('ci-8')
  expect(policy(github)).toEqual({ queue: 'single', cancel: true })
})

test('dispatch, tags, other branches and missing head commits do not enter release push groups', () => {
  for (const github of [
    { ...release, event_name: 'workflow_dispatch' },
    { ...release, ref: 'refs/tags/v0.75.425' },
    { ...release, ref: 'refs/heads/feature' },
    { ...release, event: {} },
  ]) {
    expect(group(github)).toBe(`ci-${github.ref}`)
    expect(policy(github)).toEqual({ queue: 'max', cancel: false })
  }
})
