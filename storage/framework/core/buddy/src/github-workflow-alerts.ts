import { validateWorkflowScheduleName } from './github-workflow-schedule'

export interface GitHubWorkflowAlerts {
  name: string
  expiresOn: string
  from: string
  to: string
  heartbeatMinutes?: number
}

const day = 86_400_000

const mailer = `
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2')
const client = new SESv2Client({})
exports.handler = async (event) => {
  const { SCHEDULE_NAME, FROM, TO } = process.env
  let subject
  let message
  if (event.kind === 'expiry') {
    subject = '[Buddy] GitHub token renewal for ' + SCHEDULE_NAME
    message = 'The GitHub token for ' + SCHEDULE_NAME + ' expires on ' + event.expiresOn + '. Renew it before that date and update the EventBridge connection with buddy schedule:github:deploy --token-stdin. Then set the new expiry with buddy schedule:github:alerts.'
  }
  else if (event.kind === 'test') {
    subject = '[Buddy test] Alert delivery for ' + SCHEDULE_NAME
    message = 'This is a scheduled test of the independent AWS alert path. No production incident is being reported.'
  }
  else if (event.alarmData?.state?.value === 'ALARM') {
    subject = '[Buddy] GitHub dispatch alert for ' + SCHEDULE_NAME
    message = event.alarmData.alarmName + ' entered ALARM. Check the AWS EventBridge rule and GitHub credential. GitHub may no longer be starting the production check.\\n\\n' + event.alarmData.state.reason
  }
  else {
    throw new Error('Unrecognized Buddy scheduler alert')
  }
  const { MessageId } = await client.send(new SendEmailCommand({
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [TO] },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: message, Charset: 'UTF-8' } } } },
  }))
  console.log(JSON.stringify({ kind: event.kind || 'alarm', messageId: MessageId }))
  return { messageId: MessageId }
}
`

export function workflowAlertsTemplate(options: GitHubWorkflowAlerts, now = new Date()): string {
  const { name, expiresOn, from, to, heartbeatMinutes = 40 } = options
  validateWorkflowScheduleName(name)
  const date = new Date(`${expiresOn}T18:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== expiresOn)
    throw new Error('Specify the token expiry date as YYYY-MM-DD')
  if (expiresOn <= now.toISOString().slice(0, 10))
    throw new Error('The GitHub token expiry date must be in the future')
  if (![from, to].every(address => /^[\w.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address)))
    throw new Error('Specify individual email addresses for the SES sender and alert recipient')
  if (!Number.isInteger(heartbeatMinutes) || heartbeatMinutes % 5 !== 0 || heartbeatMinutes < 15 || heartbeatMinutes > 1_440)
    throw new Error('The heartbeat window must be a multiple of five minutes between 15 and 1440')

  const group = `${name}-alerts`
  const functionName = `${name}-schedule-alerts`
  const mailerArn = { 'Fn::GetAtt': ['Mailer', 'Arn'] }
  const logGroup = `/aws/lambda/${functionName}`
  const identity = from.split('@')[1]
  const namespace = 'AWS/Events'
  const dimensions = [{ Name: 'RuleName', Value: name }]
  const failures = `${name}-dispatch-failed`
  const missing = `${name}-dispatch-missing`
  const soon = new Date(Math.ceil((+now + 120_000) / 60_000) * 60_000)
  const reminderDates = [14, 3].map(days => new Date(+date - days * day)).filter(value => value > soon)
  if (reminderDates.length < 2)
    reminderDates.unshift(soon)
  const reminders = Object.fromEntries(reminderDates.map((at, index) => [`Reminder${index + 1}`, {
    Type: 'AWS::Scheduler::Schedule',
    Properties: {
      Name: `${name}-expiry-${index + 1}`,
      GroupName: { Ref: 'ScheduleGroup' },
      ScheduleExpression: `at(${at.toISOString().slice(0, 19)})`,
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      State: 'ENABLED',
      Target: {
        Arn: mailerArn,
        RoleArn: { 'Fn::GetAtt': ['ScheduleRole', 'Arn'] },
        Input: JSON.stringify({ kind: 'expiry', expiresOn }),
      },
    },
  }]))
  const permission = (alarmName: string) => ({
    Type: 'AWS::Lambda::Permission',
    Properties: {
      Action: 'lambda:InvokeFunction',
      FunctionName: mailerArn,
      Principal: 'lambda.alarms.cloudwatch.amazonaws.com',
      SourceAccount: { Ref: 'AWS::AccountId' },
      SourceArn: { 'Fn::Sub': `arn:\${AWS::Partition}:cloudwatch:\${AWS::Region}:\${AWS::AccountId}:alarm:${alarmName}` },
    },
  })

  return JSON.stringify({
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Buddy GitHub workflow expiry and delivery alerts',
    Resources: {
      Logs: { Type: 'AWS::Logs::LogGroup', Properties: { LogGroupName: logGroup, RetentionInDays: 14 } },
      MailRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
          Policies: [{
            PolicyName: 'SendBuddyAlert',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Action: 'ses:SendEmail',
                  Resource: [identity, from].map(sender => ({ 'Fn::Sub': `arn:\${AWS::Partition}:ses:\${AWS::Region}:\${AWS::AccountId}:identity/${sender}` })),
                  Condition: { StringEquals: { 'ses:FromAddress': from }, 'ForAllValues:StringEquals': { 'ses:Recipients': [to] } },
                },
                { Effect: 'Allow', Action: ['logs:CreateLogStream', 'logs:PutLogEvents'], Resource: { 'Fn::GetAtt': ['Logs', 'Arn'] } },
              ],
            },
          }],
        },
      },
      Mailer: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          FunctionName: functionName,
          Runtime: 'nodejs24.x',
          Handler: 'index.handler',
          Role: { 'Fn::GetAtt': ['MailRole', 'Arn'] },
          Timeout: 15,
          Code: { ZipFile: mailer },
          Environment: { Variables: { SCHEDULE_NAME: name, FROM: from, TO: to } },
        },
      },
      ScheduleGroup: { Type: 'AWS::Scheduler::ScheduleGroup', Properties: { Name: group } },
      ScheduleRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: { Service: 'scheduler.amazonaws.com' },
              Action: 'sts:AssumeRole',
              Condition: {
                StringEquals: { 'aws:SourceAccount': { Ref: 'AWS::AccountId' } },
                ArnEquals: { 'aws:SourceArn': { 'Fn::GetAtt': ['ScheduleGroup', 'Arn'] } },
              },
            }],
          },
          Policies: [{
            PolicyName: 'InvokeBuddyAlert',
            PolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 'lambda:InvokeFunction', Resource: mailerArn }] },
          }],
        },
      },
      FailedAlarmPermission: permission(failures),
      MissingAlarmPermission: permission(missing),
      FailedDeliveries: {
        Type: 'AWS::CloudWatch::Alarm',
        DependsOn: 'FailedAlarmPermission',
        Properties: {
          AlarmName: failures,
          AlarmDescription: 'An EventBridge dispatch failed permanently. Check the GitHub token and workflow.',
          AlarmActions: [mailerArn],
          Namespace: namespace,
          Dimensions: dimensions,
          MetricName: 'FailedInvocations',
          Statistic: 'Sum',
          // The half-hour bucket keeps a persistently rejected 15-minute
          // schedule in one alarm state instead of re-alerting on every run.
          Period: 1_800,
          EvaluationPeriods: 1,
          Threshold: 1,
          ComparisonOperator: 'GreaterThanOrEqualToThreshold',
          TreatMissingData: 'notBreaching',
        },
      },
      MissingDeliveries: {
        Type: 'AWS::CloudWatch::Alarm',
        DependsOn: 'MissingAlarmPermission',
        Properties: {
          AlarmName: missing,
          AlarmDescription: `No successful EventBridge dispatch was recorded in the last ${heartbeatMinutes} minutes.`,
          AlarmActions: [mailerArn],
          EvaluationPeriods: heartbeatMinutes / 5,
          Threshold: 1,
          ComparisonOperator: 'LessThanThreshold',
          TreatMissingData: 'breaching',
          Metrics: [
            { Id: 'delivery', MetricStat: { Metric: { Namespace: namespace, Dimensions: dimensions, MetricName: 'SuccessfulInvocationAttempts' }, Period: 300, Stat: 'Sum' }, ReturnData: false },
            { Id: 'heartbeat', Expression: 'FILL(delivery, 0)', ReturnData: true },
          ],
        },
      },
      ...reminders,
    },
    Outputs: {
      ExpiresOn: { Value: expiresOn },
      ReminderTimesUTC: { Value: reminderDates.map(value => value.toISOString()).join(', ') },
      ScheduleGroup: { Value: { Ref: 'ScheduleGroup' } },
      ScheduleRoleArn: { Value: { 'Fn::GetAtt': ['ScheduleRole', 'Arn'] } },
      MailerArn: { Value: mailerArn },
    },
  })
}
