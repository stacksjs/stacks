import { Action } from '@stacksjs/actions'
import { join } from 'node:path'
import process from 'node:process'
import { Deployment } from '@stacksjs/orm'
import { request, response } from '@stacksjs/router'
import { booleanValue, deploymentCommandArgs } from './deployment-input'

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

  async handle() {
    const dryRun = booleanValue(request.get('dryRun') || request.get('dry_run'))
    const confirmed = booleanValue(request.get('confirmed'))
    if (!dryRun && !confirmed) {
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
        dryRun,
      })
    }
    catch (error) {
      return response.json({
        success: false,
        message: error instanceof Error ? error.message : 'Deployment input is invalid.',
      }, { status: 422 })
    }

    let deployment: Awaited<ReturnType<typeof Deployment.create>> | null = null
    const startedAt = Date.now()
    if (!dryRun) {
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
        return response.json({
          success: false,
          message: error instanceof Error ? error.message : 'Deployment record could not be created.',
        }, { status: 500 })
      }
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
      if (deployment) {
        await deployment.update({
          status: 'failed',
          duration: 0,
          errorLog: error instanceof Error ? error.message : String(error),
        })
      }
      return response.json({
        success: false,
        message: error instanceof Error ? error.message : 'Deployment process could not be started.',
      }, { status: 500 })
    }

    if (deployment) {
      const record = deployment
      void child.exited.then(async (exitCode) => {
        await record.update({
          status: exitCode === 0 ? 'success' : 'failed',
          duration: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
          errorLog: exitCode === 0 ? '' : `buddy deploy exited with code ${exitCode}`,
        })
      })
    }

    return {
      success: true,
      pid: child.pid,
      command: ['./buddy', ...args],
      deployment: deployment?.toJSON() || null,
      message: dryRun ? 'Deployment preview started.' : 'Deployment started.',
    }
  },
})
