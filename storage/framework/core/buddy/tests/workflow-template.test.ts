import { expect, test } from 'bun:test'
import { renderReviewOsWorkflow } from '../src/workflow-template'

const config = {
  provider: 'reviewos' as const, origin: 'https://reviewos.org', repository: 'owner/private-app',
  runners: { checks: ['self-hosted', 'app-linux'], deploy: ['self-hosted', 'app-linux'], ios: ['self-hosted', 'app-mobile'] },
  deploy: true,
  commands: Object.fromEntries(['after-deploy', 'native-build', 'native-accept'].map(step => [step, [['bun', 'run', step]]])),
  secrets: { checks: ['PANTRY_REGISTRY_TOKEN'], deploy: ['DEPLOY_SSH_KEY'], ios: ['APP_STORE_CONNECT_KEY_ID'] },
  native: { artifacts: ['storage/native/simulator/**/*.zip', 'storage/native/simulator/**/receipt.json'], downloadDirectory: 'storage/native/received', archivePattern: '**/*.app.zip' },
}

test('normal Stacks checks, deployment and downloaded native acceptance share an ordered main pipeline', () => {
  const source = renderReviewOsWorkflow(config)
  const workflow = Bun.YAML.parse(source) as any
  expect(workflow.concurrency['cancel-in-progress']).toBe('${{ github.ref != \'refs/heads/main\' }}')
  expect(workflow.jobs.deploy.needs).toEqual(['lint', 'typecheck', 'test', 'build'])
  expect(workflow.jobs.native.needs).toEqual(['deploy'])
  expect(workflow.jobs.native['runs-on']).toEqual(config.runners.ios)
  expect(workflow.jobs.deploy.environment).toBe('production')
  expect(workflow.jobs.native.environment).toBe('ios-testflight')
  for (const name of ['lint', 'typecheck', 'test', 'build']) {
    const job = workflow.jobs[name]
    expect(job.environment).toBeUndefined()
    expect(job.steps.some((step: any) => step.run === `./buddy workflow:step ${name}`)).toBe(true)
    expect(JSON.stringify(job)).not.toContain('DEPLOY_SSH_KEY')
    expect(JSON.stringify(job)).not.toContain('APP_STORE_CONNECT_KEY_ID')
  }
  expect(workflow.jobs.native.steps.map((step: any) => step.name)).toEqual(expect.arrayContaining(['Build the simulator application', 'Publish the simulator application', 'Download the published application', 'Accept the downloaded application']))
  expect(workflow.jobs.native.steps.find((step: any) => step.name === 'Remove temporary signing material').if).toBe('always()')
  const download = workflow.jobs.native.steps.find((step: any) => step.name === 'Download the published application')
  expect(download.with.path).toBe(config.native.downloadDirectory)
  expect(workflow.jobs.deploy.if).toContain("github.ref == 'refs/heads/main'")
  expect(workflow.jobs.deploy.if).toContain("github.event_name != 'pull_request'")
  expect(source).not.toContain('gh ')
  expect(workflow.jobs.native.steps.some((step: any) => step.name === 'Preserve acceptance and release receipts')).toBe(false)
})

test('workflow generation refuses incomplete native or unsafe secret and runner declarations', () => {
  expect(() => renderReviewOsWorkflow({ ...config, runners: { checks: [] } })).toThrow()
  expect(() => renderReviewOsWorkflow({ ...config, secrets: { checks: ['bad name'] } })).toThrow()
  expect(() => renderReviewOsWorkflow({ ...config, native: { ...config.native, downloadDirectory: '../outside' } })).toThrow()
})
