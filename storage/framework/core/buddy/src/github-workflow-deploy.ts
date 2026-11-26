import type { AWSCloudFormationClient } from '@stacksjs/ts-cloud'
import type { GitHubWorkflowSchedule } from './github-workflow-schedule'
import { rearmWorkflowAlertsTemplate, validateWorkflowTokenExpiry } from './github-workflow-alerts'
import { workflowScheduleTemplate } from './github-workflow-schedule'

type CloudFormation = Pick<AWSCloudFormationClient, 'createStack' | 'describeStacks' | 'getTemplate' | 'updateStack' | 'waitForStackComplete'>

async function findStack(client: CloudFormation, stackName: string) {
  return client.describeStacks({ stackName }).then(result => result.Stacks?.[0], (error) => {
    if (error instanceof Error && error.message.includes('does not exist'))
      return undefined
    throw error
  })
}

async function updateStack(client: CloudFormation, input: Parameters<CloudFormation['updateStack']>[0]): Promise<boolean> {
  try {
    await client.updateStack(input)
    return true
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('No updates are to be performed'))
      return false
    throw error
  }
}

async function waitForUpdate(client: CloudFormation, stackName: string): Promise<void> {
  const result = await client.waitForStackComplete(stackName, 60, 3_000)
  if (!result.success || result.status === 'DELETE_COMPLETE')
    throw new Error(`${stackName} did not finish updating (${result.status})`)
}

export async function deployWorkflowSchedule(client: CloudFormation, schedule: GitHubWorkflowSchedule, token = ''): Promise<string> {
  const { name, tokenExpiresOn } = schedule
  // Validate user inputs before using the name in a cloud request.
  const initialTemplate = workflowScheduleTemplate(schedule)
  if (token && !/^github_pat_[a-z0-9_]+$/i.test(token))
    throw new Error('Pipe a GitHub fine-grained token into this command with --token-stdin')
  if (tokenExpiresOn !== undefined)
    validateWorkflowTokenExpiry(tokenExpiresOn)

  const stackName = `stacks-${name}-schedule`
  const alertName = `${stackName}-alerts`
  const current = await findStack(client, stackName)
  if (!current && !token)
    throw new Error('Pipe a GitHub fine-grained token into this command with --token-stdin')

  const recordedExpiry = current?.Outputs?.find(output => output.OutputKey === 'TokenExpiresOn')?.OutputValue
  const repair = !token && tokenExpiresOn !== undefined
  if (repair && tokenExpiresOn !== recordedExpiry)
    throw new Error('Use --token-stdin to change the expiry date of the active credential')

  const alerts = token || repair ? await findStack(client, alertName) : undefined
  if (repair && !alerts)
    throw new Error('Deploy schedule:github:alerts before rearming expiry reminders')
  if (alerts) {
    if (!tokenExpiresOn)
      throw new Error('Use --expires-on YYYY-MM-DD to rearm the existing expiry reminders with this rotation')
    const existing = await client.getTemplate(alertName)
    rearmWorkflowAlertsTemplate(existing.TemplateBody, name, tokenExpiresOn)
  }

  const settings = {
    stackName,
    templateBody: !token && recordedExpiry ? workflowScheduleTemplate({ ...schedule, tokenExpiresOn: recordedExpiry }) : initialTemplate,
    capabilities: ['CAPABILITY_IAM'],
    parameters: [{ ParameterKey: 'GitHubToken', ParameterValue: token, UsePreviousValue: !token }],
  }
  let changed = false
  if (!repair) {
    if (current)
      changed = await updateStack(client, settings)
    else {
      await client.createStack({ ...settings, onFailure: 'ROLLBACK' })
      changed = true
    }
  }

  if (!alerts)
    return changed ? `CloudFormation deployment started for ${stackName}.` : 'The workflow schedule is already up to date.'

  if (changed)
    await waitForUpdate(client, stackName)
  const currentExpiry = async () => {
    let active = await findStack(client, stackName)
    if (active?.StackStatus.endsWith('_IN_PROGRESS')) {
      await waitForUpdate(client, stackName)
      active = await findStack(client, stackName)
    }
    return active?.Outputs?.find(output => output.OutputKey === 'TokenExpiresOn')?.OutputValue
  }
  try {
    if (recordedExpiry !== tokenExpiresOn && await currentExpiry() === recordedExpiry)
      throw new Error('CloudFormation has not confirmed the new credential expiry')
    // A later rotation can complete while this one is rearming the alerts. Re-read
    // the committed date so an older run cannot report success with stale reminders.
    for (let attempt = 0; attempt < 3; attempt++) {
      const expiresOn = await currentExpiry()
      if (!expiresOn)
        throw new Error('CloudFormation has not confirmed the expiry date for the active credential')
      const { TemplateBody } = await client.getTemplate(alertName)
      const templateBody = rearmWorkflowAlertsTemplate(TemplateBody, name, expiresOn)
      if (templateBody !== TemplateBody) {
        const updated = await updateStack(client, { stackName: alertName, templateBody, capabilities: ['CAPABILITY_IAM'] }).catch((error) => {
          if (error instanceof Error && /UPDATE_(?:COMPLETE_CLEANUP_)?IN_PROGRESS/.test(error.message))
            return true
          throw error
        })
        if (updated)
          await waitForUpdate(client, alertName)
      }
      const live = await findStack(client, alertName)
      if (live?.Outputs?.some(output => output.OutputKey === 'ExpiresOn' && output.OutputValue === expiresOn) && await currentExpiry() === expiresOn)
        return repair ? `GitHub token expiry reminders are armed for ${expiresOn}.` : `GitHub token deployed and expiry reminders armed for ${expiresOn}.`
    }
    throw new Error('The active credential or alert stack changed during rearming')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Expiry reminders could not be verified. Retry the same rotation, or rerun with --expires-on ${tokenExpiresOn} to repair the reminders for the active credential. ${message}`, { cause: error })
  }
}
