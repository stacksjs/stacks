import { expect, test } from 'bun:test'
import { workflowAlertsTemplate } from '../src/github-workflow-alerts'

const alerts = {
  name: 'realtime-check',
  expiresOn: '2027-02-24',
  from: 'sender@example.com',
  to: 'owner@example.com',
}

test('schedules two AWS reminders and monitors both failed and missing dispatches', () => {
  const { Resources, Outputs } = JSON.parse(workflowAlertsTemplate(alerts, new Date('2026-11-26T23:00:00Z')))
  expect(Outputs.ReminderTimesUTC.Value).toBe('2027-02-10T18:00:00.000Z, 2027-02-21T18:00:00.000Z')
  expect(Resources.Reminder1.Properties.Target.Input).toBe('{"kind":"expiry","expiresOn":"2027-02-24"}')
  expect(Resources.FailedDeliveries.Properties.MetricName).toBe('FailedInvocations')
  expect(Resources.MissingDeliveries.Properties.Metrics[0].MetricStat.Metric.MetricName).toBe('SuccessfulInvocationAttempts')
  expect(Resources.MissingDeliveries.Properties.EvaluationPeriods).toBe(8)
  expect(Resources.MissingDeliveries.Properties.TreatMissingData).toBe('breaching')
})

test('schedules an immediate reminder when both reminder dates have passed', () => {
  const { Resources } = JSON.parse(workflowAlertsTemplate(alerts, new Date('2027-02-23T12:00:23Z')))
  expect(Resources.Reminder1.Properties.ScheduleExpression).toBe('at(2027-02-23T12:03:00)')
  expect(Resources.Reminder2).toBeUndefined()
  expect(() => workflowAlertsTemplate({ ...alerts, expiresOn: '2027-02-31' }, new Date('2027-02-10T12:00:00Z'))).toThrow()
})
