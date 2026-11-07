import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const text = readFileSync(new URL('../../workflows/configure-launchpad-deployment.yml', import.meta.url), 'utf8')
const workflow = Bun.YAML.parse(text) as any

test('host credential setup is protected and never deploys an attached application', () => {
  expect(workflow.jobs.configure.if).toContain("github.ref == 'refs/heads/main'")
  expect(workflow.jobs.configure.environment).toBe('production')
  expect(text).toContain('--repo stacksjs/launchpad --env website-production')
  expect(text).not.toContain('./buddy deploy')
  expect(text).not.toContain('secrets.DOTENV_PRIVATE_KEY_PRODUCTION')
  expect(text).not.toContain('PORKBUN_SECRET_KEY')
})
