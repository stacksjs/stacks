import { expect, test } from 'bun:test'
import { workflowScheduleTemplate } from '../src/github-workflow-schedule'

const schedule = {
  name: 'realtime-check',
  repository: 'owner/predicthq',
  workflow: 'realtime-monitor.yml',
  ref: 'main',
  expression: 'cron(2/15 * * * ? *)',
  recordSchedule: true,
}

test('uses a masked token and passes the AWS event timestamp to the GitHub workflow', () => {
  const template = JSON.parse(workflowScheduleTemplate(schedule))
  expect(template.Parameters.GitHubToken.NoEcho).toBe(true)
  expect(template.Resources.Destination.Properties.InvocationEndpoint)
    .toBe('https://api.github.com/repos/owner/predicthq/actions/workflows/realtime-monitor.yml/dispatches')
  const rule = template.Resources.Rule.Properties
  expect(rule.ScheduleExpression).toBe(schedule.expression)
  expect(rule.Targets[0].InputTransformer).toEqual({
    InputPathsMap: { scheduledAt: '$.time' },
    InputTemplate: '{"ref":"main","inputs":{"scheduled_at":"<scheduledAt>"}}',
  })
})

test('supports workflows without a timestamp input and rejects external destinations', () => {
  const template = JSON.parse(workflowScheduleTemplate({ ...schedule, recordSchedule: false }))
  expect(template.Resources.Rule.Properties.Targets[0].Input).toBe('{"ref":"main"}')
  expect(() => workflowScheduleTemplate({ ...schedule, repository: 'owner/predicthq?target=https://example.org' })).toThrow()
  expect(() => workflowScheduleTemplate({ ...schedule, workflow: '../checks.yml' })).toThrow()
})
