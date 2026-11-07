import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const workflow = Bun.YAML.parse(readFileSync(new URL('../../workflows/deploy-attached-sites.yml', import.meta.url), 'utf8')) as any

test('attached production deploys are restricted to main and the Launchpad service', () => {
  const job = workflow.jobs.deploy
  expect(job.environment).toBe('production')
  expect(job.if).toContain("github.ref == 'refs/heads/main'")
  expect(workflow.on.workflow_dispatch.inputs.project.options).toEqual(['launchpad'])
  const checkout = job.steps.find((step: any) => step.uses?.startsWith('actions/checkout'))
  expect(checkout.with.ref).toBe('main')
  expect(checkout.with.repository).toBe('stacksjs/launchpad')
})

test('tenant releases receive their own decryption key and actual checked-out revision', () => {
  const deploy = workflow.jobs.deploy.steps.find((step: any) => step.run === './buddy deploy --prod --yes')
  expect(deploy.env.DOTENV_PRIVATE_KEY_PRODUCTION).toContain('secrets.LAUNCHPAD_SERVER_DOTENV_PRIVATE_KEY_PRODUCTION')
  expect(deploy.env.DOTENV_PRIVATE_KEY_PRODUCTION).not.toContain('secrets.DOTENV_PRIVATE_KEY_PRODUCTION')
  expect(deploy.env.GITHUB_SHA).toBe('${{ env.TENANT_SHA }}')
  expect(deploy.env.GITHUB_REF).toBe('refs/heads/main')
  expect(deploy.env.PORKBUN_API_KEY).toBe('${{ secrets.PORKBUN_API_KEY }}')
})

test('the website deploy waits for the independent API and keeps the host key in the host job', () => {
  expect(workflow.jobs.website.needs).toBe('deploy')
  expect(workflow.jobs.website.environment).toBe('production')
  const tenant = workflow.jobs.deploy.steps.find((step: any) => step.run === './buddy deploy --prod --yes')
  const host = workflow.jobs.website.steps.find((step: any) => step.run?.includes('./buddy deploy --prod --site launchpad --yes'))
  expect(host.env.DOTENV_PRIVATE_KEY_PRODUCTION).toBe('${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}')
  expect(tenant.env.DOTENV_PRIVATE_KEY_PRODUCTION).not.toBe(host.env.DOTENV_PRIVATE_KEY_PRODUCTION)
  expect(workflow.jobs.deploy.steps.some((step: any) => step.name === 'Verify independent service over HTTPS')).toBe(true)
})
