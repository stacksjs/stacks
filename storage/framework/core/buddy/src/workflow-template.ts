import type { WorkflowConfig } from '@stacksjs/types'

function relativePath(value: string): boolean {
  return typeof value === 'string' && !!value && !/^[A-Za-z]:|^[\\/]|[\\\r\n\x00]/.test(value) && !value.split('/').some(segment => segment === '.' || segment === '..')
}

export function validateWorkflowConfig(config: WorkflowConfig): void {
  const origin = new URL(config.origin)
  if (config.provider !== 'reviewos' || origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || !/^[\w.-]+\/[\w.-]+$/.test(config.repository) || config.repository.split('/').some(part => part === '.' || part === '..')) throw new Error('Configure a canonical ReviewOS origin and owner/repository')
  for (const group of ['checks', ...(config.deploy ? ['deploy'] : []), ...(config.native ? ['ios'] : [])] as const) {
    const labels = config.runners[group as keyof WorkflowConfig['runners']]
    if (!Array.isArray(labels) || !labels.includes('self-hosted') || labels.some(label => !/^[\w.-]+$/.test(label))) throw new Error(`Declare the owned ${group} runner labels`)
  }
  for (const values of Object.values(config.env ?? {})) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.entries(values).some(([name, value]) => !/^[A-Z_][A-Z0-9_]*$/.test(name) || typeof value !== 'string' || value.includes('\x00'))) throw new Error('Workflow environment settings must be named string values')
  }
  for (const names of Object.values(config.secrets ?? {})) {
    if (!Array.isArray(names) || names.some(name => !/^[A-Z_][A-Z0-9_]*$/.test(name))) throw new Error('Workflow secrets must be environment variable names')
  }
  for (const [step, names] of Object.entries(config.stepSecrets ?? {})) {
    if (!['native-build', 'native-accept', 'native-sign', 'native-upload', 'native-verify', 'native-cleanup'].includes(step)
      || !Array.isArray(names) || names.some(name => !config.secrets?.ios?.includes(name))) throw new Error('Step credentials must name declared native secrets')
  }
  if (config.native && (!config.native.artifacts.length || ![...config.native.artifacts, config.native.downloadDirectory, config.native.archivePattern, ...(config.native.evidence ?? []), ...(config.native.releaseArtifacts ?? [])].every(relativePath))) throw new Error('Native artifacts must stay inside the workspace')
  if (config.deploy && !config.commands?.['after-deploy']?.length) throw new Error('Configure deployed application verification')
  if (config.native && ['native-build', 'native-accept'].some(step => !config.commands?.[step as keyof typeof config.commands]?.length)) throw new Error('Configure native build and downloaded acceptance commands')
  if (config.release && (!config.native || ['native-sign', 'native-upload', 'native-verify', 'native-cleanup'].some(step => !config.commands?.[step as keyof typeof config.commands]?.length))) throw new Error('Configure native signing, upload, verification and cleanup before releasing')
  if (config.release && (!relativePath(config.release.versionFile) || config.release.notesDirectory !== undefined && !relativePath(config.release.notesDirectory) || config.release.locales?.some(locale => !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)))) throw new Error('Release files and locales must stay inside the workspace')
  for (const commands of Object.values(config.commands ?? {})) {
    if (!Array.isArray(commands) || commands.some(argv => !Array.isArray(argv) || !argv.length || argv.some(arg => typeof arg !== 'string' || arg.includes('\x00')))) throw new Error('Workflow commands must be nonempty argv arrays')
  }
}

/** A single ordered pipeline keeps deployment fixed for its native acceptance. */
export function renderReviewOsWorkflow(config: WorkflowConfig): string {
  validateWorkflowConfig(config)
  const branch = config.branch ?? 'main'
  if (!/^[\w./-]+$/.test(branch) || branch.includes('..')) throw new Error('Configure a branch name')
  const main = `github.ref == 'refs/heads/${branch}' && github.event_name != 'pull_request'`
  const upload = "steps.release.outputs.upload == 'true'"
  const secretEnv = (group: 'checks' | 'deploy' | 'ios') => Object.fromEntries((config.secrets?.[group] ?? []).map(name => [name, '${{ secrets.' + name + ' }}']))
  const nativeSecrets = (step: keyof NonNullable<WorkflowConfig['stepSecrets']>) => {
    const names = config.stepSecrets?.[step] ?? (step === 'native-sign' ? config.secrets?.ios ?? [] : [])
    return names.length ? { env: Object.fromEntries(names.map(name => [name, '${{ secrets.' + name + ' }}'])) } : {}
  }
  const bootstrap = () => [
    { name: 'Checkout the exact source', uses: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262', with: { 'fetch-depth': 0, 'persist-credentials': false } },
    { name: 'Set up the pinned tools', uses: 'pantry-pm/pantry/packages/action@624cd6674f8c5c2d4e4204c11ece62a00d7fac0a', with: { version: config.pantry ?? '0.11.199', install: 'false', packages: `bun.sh@${config.bun ?? '1.4.4'}` } },
    { name: 'Install the frozen application dependencies', run: 'bun install --frozen-lockfile' },
    { name: 'Prepare declared application inputs', run: './buddy workflow:step prepare' },
  ]
  const jobs: Record<string, any> = {}
  for (const name of ['lint', 'typecheck', 'test', 'build']) jobs[name] = {
    'runs-on': config.runners.checks,
    'timeout-minutes': name === 'test' ? 90 : 30,
    reviewos: { secrets: config.secrets?.checks ?? [] }, env: { ...config.env?.checks, ...secretEnv('checks') },
    steps: [...bootstrap(), { name: `Run ${name}`, run: `./buddy workflow:step ${name}` }],
  }
  if (config.deploy) jobs.deploy = {
    needs: ['lint', 'typecheck', 'test', 'build'], if: main,
    'runs-on': config.runners.deploy, 'timeout-minutes': 60, environment: 'production',
    reviewos: { secrets: [...(config.secrets?.checks ?? []), ...(config.secrets?.deploy ?? [])] }, env: { ...config.env?.checks, ...config.env?.deploy, ...secretEnv('checks'), ...secretEnv('deploy') },
    steps: [...bootstrap(), { name: 'Deploy the qualified source', run: './buddy workflow:step deploy' }, { name: 'Verify the deployed application', run: './buddy workflow:step after-deploy' }],
  }
  if (config.native) jobs.native = {
    needs: config.deploy ? ['deploy'] : ['lint', 'typecheck', 'test', 'build'], if: main,
    'runs-on': config.runners.ios, 'timeout-minutes': 90, environment: 'ios-testflight',
    reviewos: { secrets: [...(config.secrets?.checks ?? []), ...(config.secrets?.ios ?? [])] }, env: { ...config.env?.checks, ...config.env?.ios, ...secretEnv('checks') },
    steps: [...bootstrap(),
      { name: 'Read the committed release identity', id: 'release', run: './buddy workflow:release-state', env: { WORKFLOW_UPLOAD_REQUESTED: "${{ inputs.upload && 'true' || 'false' }}" } },
      { name: 'Build the simulator application', run: './buddy workflow:step native-build', ...nativeSecrets('native-build') },
      { name: 'Publish the simulator application', uses: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', with: { name: 'native-simulator-${{ github.run_id }}', path: config.native.artifacts.join('\n'), 'if-no-files-found': 'error', 'retention-days': 7 } },
      { name: 'Download the published application', uses: 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093', with: { name: 'native-simulator-${{ github.run_id }}', path: config.native.downloadDirectory } },
      { name: 'Accept the downloaded application', run: './buddy workflow:step native-accept', ...nativeSecrets('native-accept') },
      { name: 'Prepare temporary signing material', if: upload, run: './buddy workflow:step native-sign', ...nativeSecrets('native-sign') },
      { name: 'Upload the accepted application', if: upload, run: './buddy workflow:step native-upload', ...nativeSecrets('native-upload') },
      { name: 'Verify tester availability', if: upload, run: './buddy workflow:step native-verify', ...nativeSecrets('native-verify') },
      { name: 'Remove temporary signing material', if: 'always()', run: './buddy workflow:step native-cleanup', ...nativeSecrets('native-cleanup') },
      ...([...(config.native.evidence ?? []), ...(config.native.releaseArtifacts ?? [])].length ? [{ name: 'Preserve acceptance and release receipts', if: 'always()', uses: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02', with: { name: 'native-evidence-${{ github.run_id }}', path: [...(config.native.evidence ?? []), ...(config.native.releaseArtifacts ?? [])].join('\n'), 'if-no-files-found': 'warn', 'retention-days': 7 } }] : []),
    ],
  }
  return '# Generated by buddy workflow:setup from config/workflows.ts.\n' + Bun.YAML.stringify({
    name: 'CI', on: { push: { branches: [branch] }, pull_request: { branches: [branch] }, workflow_dispatch: { inputs: { upload: { type: 'boolean', default: false, description: 'Upload a committed release after native acceptance' } } } },
    concurrency: { group: 'stacks-app-${{ github.ref }}', 'cancel-in-progress': `\${{ github.ref != 'refs/heads/${branch}' }}` },
    permissions: { contents: 'read' }, jobs,
  }, null, 2)
}
