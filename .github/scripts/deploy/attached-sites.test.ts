import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const workflow = Bun.YAML.parse(readFileSync(new URL('../../workflows/deploy-attached-sites.yml', import.meta.url), 'utf8')) as any

test('attached production deploys are restricted to main and the two owned tenants', () => {
  const job = workflow.jobs.deploy
  expect(job.environment).toBe('production')
  expect(job.if).toContain("github.ref == 'refs/heads/main'")
  expect(workflow.on.workflow_dispatch.inputs.project.options).toEqual(['launchpad', 'dtsx'])
  const checkout = job.steps.find((step: any) => step.uses?.startsWith('actions/checkout'))
  expect(checkout.with.ref).toBe('main')
  expect(checkout.with.repository).toContain("'stacksjs/launchpad' || 'stacksjs/dtsx'")
})

test('tenant releases receive their own decryption key and actual checked-out revision', () => {
  const deploy = workflow.jobs.deploy.steps.find((step: any) => step.run === './buddy deploy --prod --yes')
  expect(deploy.env.DOTENV_PRIVATE_KEY_PRODUCTION).toContain('secrets.LAUNCHPAD_SERVER_DOTENV_PRIVATE_KEY_PRODUCTION')
  expect(deploy.env.DOTENV_PRIVATE_KEY_PRODUCTION).toContain('secrets.DTSX_DOTENV_PRIVATE_KEY_PRODUCTION')
  expect(deploy.env.DOTENV_PRIVATE_KEY_PRODUCTION).not.toContain('secrets.DOTENV_PRIVATE_KEY_PRODUCTION')
  expect(deploy.env.GITHUB_SHA).toBe('${{ env.TENANT_SHA }}')
  expect(deploy.env.GITHUB_REF).toBe('refs/heads/main')
  expect(deploy.env.PORKBUN_API_KEY).toBe('${{ secrets.PORKBUN_API_KEY }}')
})
