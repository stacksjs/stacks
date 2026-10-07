import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

/**
 * The pull-request preview workflow a new app is scaffolded with
 * (stacksjs/stacks#735). What it must never do matters more than what it
 * does: hand a fork's code the app's secrets, or a preview production's.
 */
const template = readFileSync(new URL('../../../defaults/vcs/github/workflows/preview.yml', import.meta.url), 'utf8')
const workflow = Bun.YAML.parse(template) as any
const job = workflow.jobs.preview
const steps: Array<{ name: string, if?: string, run?: string, env?: Record<string, string> }> = job.steps

describe('the scaffolded preview workflow', () => {
  it('deploys on every push to a pull request and removes on close', () => {
    expect(workflow.on.pull_request.types).toEqual(['opened', 'synchronize', 'reopened', 'closed'])
    expect(steps.find(s => s.name === 'Deploy the preview')!.run).toBe('./buddy deploy:preview "$PREVIEW"')
    expect(steps.find(s => s.name === 'Deploy the preview')!.if).toContain('github.event.action != \'closed\'')
    expect(steps.find(s => s.name === 'Remove the preview')!.run).toBe('./buddy deploy:preview:remove "$PREVIEW"')
    expect(steps.find(s => s.name === 'Remove the preview')!.if).toContain('github.event.action == \'closed\'')
    expect(job.env.PREVIEW).toBe('pr-${{ github.event.pull_request.number }}')
  })

  it('runs only for pull requests from this repository, never a fork\'s', () => {
    expect(job.if).toBe('github.event.pull_request.head.repo.full_name == github.repository')
    // pull_request, not pull_request_target, which would run a fork's code with secrets.
    expect(workflow.on.pull_request_target).toBeUndefined()
  })

  it('gives a preview its own secrets and never production\'s', () => {
    expect(template).not.toContain('DOTENV_PRIVATE_KEY_PRODUCTION')
    for (const name of ['Deploy the preview', 'Remove the preview'])
      expect(steps.find(s => s.name === name)!.env!.DOTENV_PRIVATE_KEY_PREVIEW).toBe('${{ secrets.DOTENV_PRIVATE_KEY_PREVIEW }}')
  })

  it('runs one at a time per pull request, never cancelling a deploy half way', () => {
    expect(workflow.concurrency).toEqual({ group: 'preview-${{ github.event.pull_request.number }}', 'cancel-in-progress': false })
  })

  it('installs from the lockfile', () => {
    expect(steps.find(s => s.run?.startsWith('bun install'))!.run).toBe('bun install --frozen-lockfile')
  })

  it('has run scripts that are valid shell', () => {
    for (const step of steps.filter(s => s.run)) {
      // Expressions are substituted by Actions before the shell sees the script.
      const script = step.run!.replace(/\$\{\{[^}]*\}\}/g, 'x')
      const check = Bun.spawnSync(['bash', '-n'], { stdin: new TextEncoder().encode(script) })
      expect({ step: step.name, ok: check.exitCode === 0, error: check.stderr.toString() }).toEqual({ step: step.name, ok: true, error: '' })
    }
  })
})
