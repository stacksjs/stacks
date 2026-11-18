import type { CLI, WorkflowStep } from '@stacksjs/types'
import { print } from '@stacksjs/cli/output'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectWorkflowClient } from '../workflow-client'
import { checkNativeWorkflowCredentials, loadWorkflowConfig, runWorkflowStep, writeProjectWorkflow, writeWorkflowReleaseState } from '../workflow-project'

export function workflow(buddy: CLI): void {
  buddy.command('workflow:setup', 'Generate the normal Stacks workflow from config/workflows.ts')
    .option('--force', 'Replace a reviewed existing custom workflow', { default: false })
    .option('--check', 'Verify committed workflow bytes without changing them', { default: false })
    .action(async (options: { force?: boolean, check?: boolean }) => {
      const root = process.cwd()
      const config = await loadWorkflowConfig(root)
      if (options.check) {
        const { renderReviewOsWorkflow } = await import('../workflow-template')
        const file = join(root, '.reviewos/workflows/ci.yml')
        if (!existsSync(file) || readFileSync(file, 'utf8') !== renderReviewOsWorkflow(config)) throw new Error('Regenerate the workflow with buddy workflow:setup')
      }
      else console.log(writeProjectWorkflow(root, config, options.force))
    })
  buddy.command('workflow:step <step>', 'Run one declared application step through Stacks')
    .action(async (step: WorkflowStep) => { await runWorkflowStep(process.cwd(), step) })
  buddy.command('workflow:check-credentials <phase>', 'Check native-accept or native-release inputs without printing credentials')
    .action(async (phase: string) => {
      await checkNativeWorkflowCredentials(process.cwd(), phase)
      print(`Workflow ${phase} credentials are configured.`)
    })
  buddy.command('workflow:release-state', 'Verify the committed release identity and set its upload output')
    .action(async () => { await writeWorkflowReleaseState(process.cwd()) })
  buddy.command('workflow:runs [file]', 'Read the exact-source workflow run history')
    .option('--sha <sha>', 'Filter by the full source commit')
    .action(async (file: string | undefined, options: { sha?: string }) => {
      const config = await loadWorkflowConfig(process.cwd())
      console.log(JSON.stringify(await projectWorkflowClient(config).runs(file ?? 'ci.yml', { branch: config.branch ?? 'main', sha: options.sha })))
    })
  buddy.command('workflow:show <number>', 'Read actual workflow job and step execution')
    .action(async (number: string) => { console.log(JSON.stringify(await projectWorkflowClient(await loadWorkflowConfig(process.cwd())).run(Number(number)))) })
  buddy.command('workflow:run [file]', 'Start a configured workflow using its normal API')
    .option('--ref <ref>', 'Source branch or revision')
    .option('--inputs <json>', 'Workflow input values as JSON, without credentials')
    .action(async (file: string | undefined, options: { ref?: string, inputs?: string }) => {
      const config = await loadWorkflowConfig(process.cwd())
      const inputs = options.inputs ? JSON.parse(options.inputs) : {}
      console.log(JSON.stringify(await projectWorkflowClient(config).dispatch(file ?? 'ci.yml', options.ref ?? config.branch ?? 'main', inputs)))
    })
  buddy.command('workflow:artifacts <number>', 'Read retained artifact identities and digests')
    .action(async (number: string) => { console.log(JSON.stringify(await projectWorkflowClient(await loadWorkflowConfig(process.cwd())).artifacts(Number(number)))) })
}
