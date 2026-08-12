import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { join } from 'node:path'
import process from 'node:process'
import { Deployment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError, dashboardOperationalIssue } from '../dashboard-response'
import { booleanValue, deploymentCommandArgs, deploymentPreviewCommandArgs } from './deployment-input'
import { runDeploymentPreview } from './deployment-preview'

function gitValue(args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
  })
  if (result.exitCode !== 0)
    throw new Error('Git metadata could not be resolved for this deployment.')
  return new TextDecoder().decode(result.stdout).trim()
}

export default new Action({
  name: 'CreateDeployment',
  description: 'Starts a confirmed non-interactive buddy deployment.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const dryRun = booleanValue(request.get('dryRun') || request.get('dry_run'))
    if (dryRun) {
      let previewArgs: string[]
      try {
        previewArgs = deploymentPreviewCommandArgs({
          environment: request.get('environment') || request.get('env'),
          domain: request.get('domain'),
        })
      }
      catch (error) {
        return response.json({
          success: false,
          message: error instanceof Error ? error.message : 'Deployment preview input is invalid.',
        }, { status: 422 })
      }

      try {
        return {
          success: true,
          plan: await runDeploymentPreview(previewArgs),
          message: 'Deployment preview generated.',
        }
      }
      catch (error) {
        return dashboardOperationalError(error, 'Deployment preview could not be generated.', 'CreateDeployment.preview', 500)
      }
    }

    const confirmed = booleanValue(request.get('confirmed'))
    if (!confirmed) {
      return response.json({
        success: false,
        confirmationRequired: true,
        message: 'Deployment confirmation is required.',
      }, { status: 409 })
    }

    let args: string[]
    try {
      args = deploymentCommandArgs({
        environment: request.get('environment') || request.get('env'),
        domain: request.get('domain'),
      })
    }
    catch (error) {
      return response.json({
        success: false,
        message: error instanceof Error ? error.message : 'Deployment input is invalid.',
      }, { status: 422 })
    }

    let deployment: Awaited<ReturnType<typeof Deployment.create>>
    const startedAt = Date.now()
    try {
      deployment = await Deployment.create({
        commitHash: gitValue(['rev-parse', '--short=12', 'HEAD']),
        commitMessage: gitValue(['log', '-1', '--pretty=%s']),
        branch: gitValue(['branch', '--show-current']),
        status: 'running',
        environment: args[2],
        author: gitValue(['log', '-1', '--pretty=%an <%ae>']),
      })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Deployment record could not be created.', 'CreateDeployment.record', 500)
    }

    let child: ReturnType<typeof Bun.spawn>
    try {
      child = Bun.spawn([join(process.cwd(), 'buddy'), ...args], {
        cwd: process.cwd(),
        stdout: 'inherit',
        stderr: 'inherit',
      })
      child.unref()
    }
    catch (error) {
      try {
        await deployment.update({
          status: 'failed',
          duration: 0,
          errorLog: 'Deployment process could not be started.',
        })
      }
      catch (updateError) {
        dashboardOperationalIssue(updateError, 'Deployment failure status could not be recorded.', 'CreateDeployment.failureRecord')
      }
      return dashboardOperationalError(error, 'Deployment process could not be started.', 'CreateDeployment.process', 500)
    }

    void child.exited
      .then(async (exitCode) => {
        await deployment.update({
          status: exitCode === 0 ? 'success' : 'failed',
          duration: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
          errorLog: exitCode === 0 ? '' : `buddy deploy exited with code ${exitCode}`,
        })
      })
      .catch((error) => {
        dashboardOperationalIssue(error, 'Deployment completion could not be recorded.', 'CreateDeployment.completionRecord')
      })

    return {
      success: true,
      pid: child.pid,
      command: ['./buddy', ...args],
      deployment: deployment.toJSON(),
      message: 'Deployment started.',
    }
  },
})
