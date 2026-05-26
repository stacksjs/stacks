import type { MakeOptions } from '@stacksjs/types'
import type { TemplateKey } from './templates'
import process from 'node:process'
import { existsSync } from 'node:fs'
import { italic, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { localUrl } from '@stacksjs/config'
import { Action } from '@stacksjs/enums'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { frameworkPath, path as p, resolve } from '@stacksjs/path'
import { createFolder, doesFolderExist, writeTextFile } from '@stacksjs/storage'
import { kebabCase, pascalCase, template } from '@stacksjs/strings'
import { runAction } from './helpers'
import { CODE_TEMPLATES } from './templates'

/**
 * Tracks whether the active `make:*` invocation is a dry-run. Set by
 * the buddy-cli dispatcher before calling into any scaffolder, read by
 * `writeOrPreview()` so every file write goes through the same gate.
 */
let isDryRun = false

/**
 * Toggle dry-run mode. The buddy CLI flips this on before invoking a
 * scaffolder when the user passed `--dry-run`. Stays a module-level
 * flag (rather than threading through every signature) so existing
 * scaffolders can opt in just by switching their write call.
 */
export function setDryRun(enabled: boolean): void {
  isDryRun = Boolean(enabled)
}

export function isDryRunActive(): boolean {
  return isDryRun
}

/**
 * Helper function to generate code from templates
 */
function generateCode(templateKey: TemplateKey, ...args: any[]): string {
  return template(CODE_TEMPLATES[templateKey], ...args)
}

/**
 * Write `data` to `path`, OR — when dry-run is active — print a diff-
 * style preview to stdout without touching disk. Scaffolders should
 * funnel all file writes through this helper so a single `--dry-run`
 * flag flips them all consistently.
 */
async function writeOrPreview(path: string, data: string): Promise<void> {
  if (isDryRun) {
    const lines = data.split('\n')
    const preview = lines.slice(0, 60).map(l => `  ${l}`).join('\n')
    const truncated = lines.length > 60 ? `\n  ${italic(`… ${lines.length - 60} more lines elided`)}` : ''
    log.info(`[dry-run] would write ${path} (${lines.length} lines)`)
    process.stdout.write(`${preview}${truncated}\n\n`)
    return
  }
  await writeTextFile({ path, data })
}

/**
 * Helper function to create a file with generated code
 */
async function createFileWithTemplate(
  path: string,
  templateKey: TemplateKey,
  ...args: any[]
): Promise<void> {
  await writeOrPreview(path, generateCode(templateKey, ...args))
}

export async function invoke(options: MakeOptions): Promise<void> {
  if (options.component)
    await makeComponent(options)
  if (options.database)
    makeDatabase(options)
  if (options.function)
    await makeFunction(options)
  if (options.language)
    await makeLanguage(options)

  if (options.middleware)
    await createMiddleware(options)

  // if (options.migration)
  //   await migration(options)

  if (options.notification)
    await makeNotification(options)
  if (options.page)
    await makePage(options)
  if (options.stack)
    await makeStack(options)
}

export async function make(options: MakeOptions): Promise<void> {
  return await invoke(options)
}

export async function makeAction(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info('Creating your action...')
    await createAction(options)
    log.success(`Created ${italic(name)} action`)
  }
  catch (error) {
    log.error('There was an error creating your action', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function makeComponent(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info('Creating your component...')
    await createComponent(options)
    log.success(`Created ${italic(name)} component`)
  }
  catch (error) {
    log.error('There was an error creating your component', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function createAction(options: MakeOptions): Promise<void> {
  const name = options.name
  // Pick the variant based on opt-in flags. Falls back to the bare
  // action stub when neither is set so the existing `buddy make:action
  // Foo` behavior is unchanged.
  const opts = options as MakeOptions & { withValidation?: boolean, withAuth?: boolean }
  const wantsValidation = Boolean(opts.withValidation || (options as any)['with-validation'])
  const wantsAuth = Boolean(opts.withAuth || (options as any)['with-auth'])
  const templateKey: TemplateKey = wantsValidation && wantsAuth
    ? 'actionWithBoth'
    : wantsValidation
      ? 'actionWithValidation'
      : wantsAuth
        ? 'actionWithAuth'
        : 'action'

  await createFileWithTemplate(p.userActionsPath(name), templateKey, name)
}

export async function createComponent(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.userComponentsPath(`${name}.vue`), 'component', name)
}

export function makeDatabase(options: MakeOptions): void {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} database...`)
    createDatabase(options)
    log.success(`Created ${italic(name)} database`)
  }
  catch (error) {
    log.error('There was an error creating your database', error)
    process.exit(ExitCode.FatalError)
  }
}

export function createDatabase(options: MakeOptions): void {
  log.debug('createDatabase options', options)
}

export function factory(options: MakeOptions): void {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} factory...`)
    createDatabase(options)
    log.success(`Created ${italic(name)} factory`)
  }
  catch (error) {
    log.error('There was an error creating your factory', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function createFactory(options: MakeOptions): Promise<void> {
  const name = options.name || 'MyFactory'
  const factoryName = name.endsWith('Factory') ? name : `${name}Factory`

  try {
    const { path: p } = await import('@stacksjs/path')
    const factoryDir = p.userDatabasePath('factories')
    const factoryPath = `${factoryDir}/${factoryName}.ts`

    // Check if factory already exists
    const file = Bun.file(factoryPath)
    if (await file.exists()) {
      log.warn(`Factory ${factoryName} already exists at ${factoryPath}`)
      return
    }

    const modelName = name.replace(/Factory$/, '')
    const content = `import type { ${modelName}Model } from '@stacksjs/orm'

export function ${factoryName}(): Partial<${modelName}Model> {
  return {
    // Define your factory attributes here
  }
}

export default ${factoryName}
`

    await writeOrPreview(factoryPath, content)
    log.success(`Created factory: ${factoryPath}`)
  }
  catch (error) {
    log.error(`Failed to create factory ${factoryName}`, error)
    throw error
  }
}

export async function makeNotification(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} notification...`)
    await createNotification(options)
    log.success(`Created ${italic(name)} notification`)
  }
  catch (error) {
    log.error('There was an error creating your notification', error)
    process.exit(ExitCode.FatalError)
  }
}

/**
 * Scaffold a Mailable + companion stx template
 * (stacksjs/stacks#1899, A2 from #1904). Pairs:
 *
 *   app/Mail/<PascalName>.ts          ← Mailable subclass
 *   resources/emails/<kebab-name>.stx ← stx template the Mailable resolves
 *
 * The name flows through both files: PascalCase for the class, kebab-case
 * for the template (matching the convention the framework's bundled
 * emails use — `welcome.stx`, `password-reset.stx`, etc.).
 *
 * Idempotent — refuses to overwrite either file when it already exists
 * unless `options.force` is true. The reason: an accidental
 * `buddy make:mail Welcome` against a project that already has a
 * customized `Welcome` mailable would silently nuke the customization
 * otherwise.
 */
export async function createMail(options: MakeOptions & { force?: boolean }): Promise<boolean> {
  const rawName = String(options.name || '').trim()
  if (!rawName) {
    log.error('A mail name is required (e.g. `buddy make:mail OrderShipped`).')
    return false
  }
  const className = pascalCase(rawName)
  const kebabName = kebabCase(rawName)

  const mailPath = p.userMailPath(`${className}.ts`)
  const templatePath = p.userEmailsPath(`${kebabName}.stx`)

  // Bail BEFORE writing either file so a partial scaffold can't leave
  // an orphaned class without its template (or vice versa) when the
  // user re-runs against a project that already has one of the two.
  // `console.error` (not log.error) so the message lands on stderr
  // before the upstream process.exit fires — the framework logger
  // batches via timers and can lose the final write on rapid exit.
  if (!options.force) {
    if (existsSync(mailPath)) {
      console.error(`${italic(mailPath)} already exists — re-run with --force to overwrite.`)
      return false
    }
    if (existsSync(templatePath)) {
      console.error(`${italic(templatePath)} already exists — re-run with --force to overwrite.`)
      return false
    }
  }

  if (!doesFolderExist(p.userMailPath()))
    await createFolder(p.userMailPath())
  if (!doesFolderExist(p.userEmailsPath()))
    await createFolder(p.userEmailsPath())

  try {
    await createFileWithTemplate(mailPath, 'mail', className, kebabName)
    await createFileWithTemplate(templatePath, 'mailTemplate', className, kebabName)
    return true
  }
  catch (error) {
    handleError('Error creating mailable', error)
    return false
  }
}

export async function makeMail(options: MakeOptions & { force?: boolean }): Promise<void> {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} mailable...`)
    const ok = await createMail(options)
    if (!ok) process.exit(ExitCode.FatalError)
    log.success(`Created ${italic(pascalCase(name))} mailable + ${italic(kebabCase(name))}.stx template`)
  }
  catch (error) {
    log.error('There was an error creating your mailable', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function makePage(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info('Creating your page...')
    await createPage(options)
    log.success(`Created ${name} page`)
  }
  catch (error) {
    log.error('There was an error creating your page', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function createPage(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.userViewsPath(`${name}.vue`), 'page', name)
}

export async function makeFunction(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info('Creating your function...')
    await createFunction(options)
    log.success(`Created ${name} function`)
  }
  catch (error) {
    log.error('There was an error creating your function', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function createFunction(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.userFunctionsPath(`${name}.ts`), 'function', name)
}

export async function makeLanguage(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info('Creating your translation file...')
    await createLanguage(options)
    log.success(`Created ${name} translation file`)
  }
  catch (error) {
    log.error('There was an error creating your language.', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function createLanguage(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.resourcesPath(`lang/${name}.yml`), 'language', name)
}

export async function makeStack(options: MakeOptions): Promise<void> {
  try {
    const name = options.name
    log.info(`Creating your ${name} stack...`)
    const stackDir = resolve(process.cwd(), name)

    if (doesFolderExist(stackDir)) {
      log.error(`Directory "${name}" already exists`)
      process.exit(ExitCode.FatalError)
    }

    // Create directory structure
    await createFolder(stackDir)
    const dirs = ['app/Actions', 'app/Models', 'config', 'database/migrations', 'resources/views', 'resources/components', 'resources/functions', 'routes', 'public']
    for (const dir of dirs) {
      await createFolder(resolve(stackDir, dir))
    }

    // Derive a short name from the package name
    const shortName = name.replace(/^@[^/]+\//, '').replace(/-stack$/, '')

    // Create package.json
    await createFileWithTemplate(resolve(stackDir, 'package.json'), 'stackPackageJson', name, shortName)

    log.success(`Successfully scaffolded your "${name}" stack`)
    log.info('')
    log.info(`  cd ${name}`)
    log.info('  # Add your models, actions, views, etc.')
    log.info('  # Then publish: bun publish')
    log.info('')
    log.info('  Users install it with:')
    log.info(`  buddy stack:install ${name}`)
  }
  catch (error) {
    log.error('There was an error creating your stack', error)
    process.exit(ExitCode.FatalError)
  }
}

export async function createNotification(options: MakeOptions): Promise<boolean> {
  const name = options.name
  try {
    let importOption = 'EmailOptions'

    if (!doesFolderExist('notifications'))
      await createFolder('./notifications')

    if (options.chat)
      importOption = 'ChatOptions'

    if (options.sms)
      importOption = 'SMSOptions'

    await createFileWithTemplate(p.userNotificationsPath(`${name}.ts`), 'notification', importOption)

    return true
  }
  catch (error) {
    handleError('Error creating notification', error)
    return false
  }
}

export async function createMigration(options: MakeOptions): Promise<void> {
  const optionName = options.name
  // const table = options.tableName
  const table = 'dummy-name'

  if (!optionName[0])
    throw new Error('options.name is required and cannot be empty')

  const name = optionName[0].toUpperCase() + optionName.slice(1)
  const path = frameworkPath(`database/migrations/${name}.ts`)

  try {
    await createFileWithTemplate(path, 'migration', table)

    log.success(`Successfully created your migration file at stacks/database/migrations/${name}.ts`)
  }
  catch (error: any) {
    log.error(error)
  }
}

export async function makeQueueTable(): Promise<void> {
  await runAction(Action.QueueTable)
}

export async function makeCertificate(): Promise<void> {
  const domain = await localUrl()

  log.info(`Creating SSL certificate...`)
  await runCommand(`tlsx ${domain}`, {
    cwd: p.storagePath('keys'),
  })

  log.success('Certificate created')

  log.info(`Installing SSL certificate...`)
  await runCommand(`tlsx -install`, {
    cwd: p.storagePath('keys'),
  })

  log.success('Certificate installed')
}

export async function createModel(options: MakeOptions): Promise<void> {
  const optionName = options.name

  if (!optionName[0])
    throw new Error('options.name is required and cannot be empty')

  const name = optionName[0].toUpperCase() + optionName.slice(1)
  const tableName = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/([^s])$/, '$1s')
  const path = p.userModelsPath(`${name}.ts`)

  try {
    await createFileWithTemplate(path, 'model', name, tableName)

    log.success(`Model created: ${italic(`app/Models/${name}.ts`)}`)
  }
  catch (error: any) {
    log.error(error)
  }
}

export async function createMiddleware(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.userMiddlewarePath(`${name}.ts`), 'middleware', name)
}
