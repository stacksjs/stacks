export interface GitHubWorkflowSchedule {
  name: string
  repository: string
  workflow: string
  ref: string
  expression: string
  recordSchedule: boolean
  tokenExpiresOn?: string
}

export function validateWorkflowScheduleName(name: string): void {
  if (!/^[a-z][a-z0-9-]{0,43}$/.test(name))
    throw new Error('Use a lowercase schedule name of at most 44 characters starting with a letter')
}

export function workflowScheduleTemplate(schedule: GitHubWorkflowSchedule): string {
  validateWorkflowScheduleName(schedule.name)
  if (!/^[\w.-]+\/[\w.-]+$/.test(schedule.repository))
    throw new Error('Use owner/repository for the GitHub repository')
  if (!/^(?:[1-9]\d*|[\w.-]+\.ya?ml)$/.test(schedule.workflow))
    throw new Error('Use a GitHub workflow ID or YAML filename')
  if (!schedule.ref.trim())
    throw new Error('Specify the GitHub branch or tag to run')
  if (!/^(?:rate\([1-9]\d* (?:minutes?|hours?|days?)\)|cron\([^)\r\n]+\))$/.test(schedule.expression))
    throw new Error('Use an AWS rate(...) or cron(...) schedule expression')

  const body = { ref: schedule.ref }
  const input = schedule.recordSchedule
    ? {
        InputTransformer: {
          InputPathsMap: { scheduledAt: '$.time' },
          InputTemplate: JSON.stringify({ ...body, inputs: { scheduled_at: '<scheduledAt>' } }),
        },
      }
    : { Input: JSON.stringify(body) }
  const destinationArn = { 'Fn::GetAtt': ['Destination', 'Arn'] }
  return JSON.stringify({
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Stacks schedule for a GitHub Actions workflow',
    Parameters: { GitHubToken: { Type: 'String', NoEcho: true } },
    Resources: {
      Connection: {
        Type: 'AWS::Events::Connection',
        Properties: {
          Name: `${schedule.name}-github`,
          AuthorizationType: 'API_KEY',
          AuthParameters: {
            ApiKeyAuthParameters: {
              ApiKeyName: 'Authorization',
              ApiKeyValue: { 'Fn::Sub': 'Bearer ${GitHubToken}' },
            },
          },
        },
      },
      Destination: {
        Type: 'AWS::Events::ApiDestination',
        Properties: {
          Name: `${schedule.name}-dispatch`,
          ConnectionArn: { 'Fn::GetAtt': ['Connection', 'Arn'] },
          HttpMethod: 'POST',
          InvocationEndpoint: `https://api.github.com/repos/${schedule.repository}/actions/workflows/${schedule.workflow}/dispatches`,
          InvocationRateLimitPerSecond: 1,
        },
      },
      InvokeRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: { Service: 'events.amazonaws.com' },
              Action: 'sts:AssumeRole',
              Condition: {
                StringEquals: { 'aws:SourceAccount': { Ref: 'AWS::AccountId' } },
                ArnEquals: { 'aws:SourceArn': { 'Fn::Sub': `arn:\${AWS::Partition}:events:\${AWS::Region}:\${AWS::AccountId}:rule/${schedule.name}` } },
              },
            }],
          },
          Policies: [{
            PolicyName: 'InvokeWorkflowDestination',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [{ Effect: 'Allow', Action: 'events:InvokeApiDestination', Resource: destinationArn }],
            },
          }],
        },
      },
      Rule: {
        Type: 'AWS::Events::Rule',
        Properties: {
          Name: schedule.name,
          ScheduleExpression: schedule.expression,
          State: 'ENABLED',
          Targets: [{
            Id: 'GitHubWorkflow',
            Arn: destinationArn,
            RoleArn: { 'Fn::GetAtt': ['InvokeRole', 'Arn'] },
            HttpParameters: { HeaderParameters: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } },
            RetryPolicy: { MaximumEventAgeInSeconds: 120, MaximumRetryAttempts: 1 },
            ...input,
          }],
        },
      },
    },
    Outputs: {
      RuleName: { Value: { Ref: 'Rule' } },
      ScheduleExpression: { Value: schedule.expression },
      ...(schedule.tokenExpiresOn ? { TokenExpiresOn: { Value: schedule.tokenExpiresOn } } : {}),
    },
  })
}
