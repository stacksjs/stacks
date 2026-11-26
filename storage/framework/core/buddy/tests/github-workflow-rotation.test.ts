import { expect, test } from 'bun:test'
import { workflowAlertsTemplate } from '../src/github-workflow-alerts'
import { deployWorkflowSchedule } from '../src/github-workflow-deploy'
import { workflowScheduleTemplate } from '../src/github-workflow-schedule'

const workflow = {
  name: 'test-rotation',
  repository: 'owner/repo',
  workflow: 'check.yml',
  ref: 'main',
  expression: 'rate(15 minutes)',
  recordSchedule: true,
}
const activeName = `stacks-${workflow.name}-schedule`
const alertsName = `${activeName}-alerts`
const originalExpiry = '2098-02-24'
const replacementExpiry = '2098-05-24'
const replacementToken = 'github_pat_fixture'

function mockCloudFormation() {
  const calls: string[] = []
  const templates = new Map([
    [activeName, workflowScheduleTemplate(workflow)],
    [alertsName, workflowAlertsTemplate({ name: workflow.name, expiresOn: originalExpiry, from: 'sender@example.org', to: 'owner@example.org', heartbeatMinutes: 85 })],
  ])
  let failRearm = false
  let additionalRotation = ''
  const client: Parameters<typeof deployWorkflowSchedule>[0] = {
    async createStack() { throw new Error('A rotation must update the existing stacks') },
    async describeStacks({ stackName = '' } = {}) {
      const template = templates.get(stackName)
      if (!template)
        return { Stacks: [] }
      const outputs = Object.entries(JSON.parse(template).Outputs as Record<string, { Value: string }>).map(([key, { Value }]) => ({ OutputKey: key, OutputValue: Value }))
      return { Stacks: [{ StackId: stackName, StackName: stackName, StackStatus: 'UPDATE_COMPLETE', CreationTime: '', Outputs: outputs }] }
    },
    async getTemplate(name) { return { TemplateBody: templates.get(name)! } },
    async updateStack({ stackName, templateBody = '' }) {
      calls.push(`update ${stackName}`)
      if (stackName === alertsName && failRearm) {
        failRearm = false
        throw new Error('Fixture failure updating reminders')
      }
      if (templates.get(stackName) === templateBody)
        throw new Error('No updates are to be performed')
      templates.set(stackName, templateBody)
      return { StackId: stackName }
    },
    async waitForStackComplete(name) {
      calls.push(`wait ${name}`)
      if (name === alertsName && additionalRotation) {
        templates.set(activeName, workflowScheduleTemplate({ ...workflow, tokenExpiresOn: additionalRotation }))
        additionalRotation = ''
      }
      return { success: true, status: 'UPDATE_COMPLETE' }
    },
  }
  return {
    client,
    calls,
    templates,
    failNextRearm: () => { failRearm = true },
    rotateDuringRearm: (expiresOn: string) => { additionalRotation = expiresOn },
  }
}

test('a protected rotation requires an expiry date before writing any stack', async () => {
  const { client, calls } = mockCloudFormation()
  await expect(deployWorkflowSchedule(client, workflow, replacementToken)).rejects.toThrow('--expires-on')
  expect(calls).toEqual([])
})

test('rotation waits for the credential update and rearms legacy alerts while preserving their settings', async () => {
  const { client, calls, templates } = mockCloudFormation()
  const original = JSON.parse(templates.get(alertsName)!)
  await expect(deployWorkflowSchedule(client, { ...workflow, tokenExpiresOn: replacementExpiry }, replacementToken))
    .resolves.toContain(replacementExpiry)
  expect(calls).toEqual([`update ${activeName}`, `wait ${activeName}`, `update ${alertsName}`, `wait ${alertsName}`])
  const updated = JSON.parse(templates.get(alertsName)!)
  expect(updated.Outputs.ReminderTimesUTC.Value).toBe('2098-05-10T18:00:00.000Z, 2098-05-21T18:00:00.000Z')
  expect(updated.Resources.Mailer).toEqual(original.Resources.Mailer)
  expect(updated.Resources.MissingDeliveries).toEqual(original.Resources.MissingDeliveries)
  await deployWorkflowSchedule(client, { ...workflow, expression: 'rate(10 minutes)' })
  expect(JSON.parse(templates.get(activeName)!).Outputs.TokenExpiresOn.Value).toBe(replacementExpiry)
})

test('retrying a rotation rearms reminders even if the credential update is already applied', async () => {
  const fixture = mockCloudFormation()
  fixture.failNextRearm()
  const replacement = { ...workflow, tokenExpiresOn: replacementExpiry }
  await expect(deployWorkflowSchedule(fixture.client, replacement, replacementToken)).rejects.toThrow('Retry the same rotation')
  expect(JSON.parse(fixture.templates.get(alertsName)!).Outputs.ExpiresOn.Value).toBe(originalExpiry)
  await expect(deployWorkflowSchedule(fixture.client, replacement, replacementToken)).resolves.toContain(replacementExpiry)
  expect(JSON.parse(fixture.templates.get(alertsName)!).Outputs.ExpiresOn.Value).toBe(replacementExpiry)
})

test('reminders can be repaired without submitting the same secret again', async () => {
  const fixture = mockCloudFormation()
  fixture.failNextRearm()
  const replacement = { ...workflow, tokenExpiresOn: replacementExpiry }
  await expect(deployWorkflowSchedule(fixture.client, replacement, replacementToken)).rejects.toThrow('Expiry reminders')
  fixture.calls.length = 0
  await expect(deployWorkflowSchedule(fixture.client, replacement)).resolves.toContain(replacementExpiry)
  expect(fixture.calls).toEqual([`update ${alertsName}`, `wait ${alertsName}`])
  await expect(deployWorkflowSchedule(fixture.client, { ...workflow, tokenExpiresOn: '2098-06-24' })).rejects.toThrow('--token-stdin')
})

test('if a later rotation wins, rearming follows the committed credential date', async () => {
  const fixture = mockCloudFormation()
  const newerExpiry = '2098-06-24'
  fixture.rotateDuringRearm(newerExpiry)
  await expect(deployWorkflowSchedule(fixture.client, { ...workflow, tokenExpiresOn: replacementExpiry }, replacementToken)).resolves.toContain(newerExpiry)
  expect(JSON.parse(fixture.templates.get(alertsName)!).Outputs.ExpiresOn.Value).toBe(newerExpiry)
})
