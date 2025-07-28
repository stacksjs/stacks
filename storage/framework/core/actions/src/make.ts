import type { MakeOptions } from '@stacksjs/types'
import type { TemplateKey } from './templates'
import process from 'node:process'
import { italic, runCommand } from '@stacksjs/cli'
import { localUrl } from '@stacksjs/config'
import { Action } from '@stacksjs/enums'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { frameworkPath, path as p, resolve } from '@stacksjs/path'
import { createFolder, doesFolderExist, writeTextFile } from '@stacksjs/storage'
import { template } from '@stacksjs/strings'
import { runAction } from './helpers'
import { CODE_TEMPLATES } from './templates'

/**
 * Helper function to generate code from templates
 */
function generateCode(templateKey: TemplateKey, ...args: any[]): string {
  return template(CODE_TEMPLATES[templateKey], ...args)
}

/**
 * Helper function to create a file with generated code
 */
async function createFileWithTemplate(
  path: string,
  templateKey: TemplateKey,
  ...args: any[]
): Promise<void> {
  await writeTextFile({
    path,
    data: generateCode(templateKey, ...args),
  })
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
    makeStack(options)
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
    process.exit()
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
    process.exit()
  }
}

export async function createAction(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.userActionsPath(name), 'action', name)
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
    process.exit()
  }
}

export function createDatabase(options: MakeOptions): void {
  console.log('createDatabase options', options) // wip
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
    process.exit()
  }
}

export function createFactory(options: MakeOptions): void {
  console.log('options', options) // wip
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
    process.exit()
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
    process.exit()
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
    process.exit()
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
    process.exit()
  }
}

export async function createLanguage(options: MakeOptions): Promise<void> {
  const name = options.name
  await createFileWithTemplate(p.resourcesPath(`lang/${name}.yml`), 'language', name)
}

export function makeStack(options: MakeOptions): void {
  try {
    const name = options.name
    log.info(`Creating your ${name} stack...`)
    const path = resolve(process.cwd(), name)

    // await spawn(`giget stacks ${path}`)
    log.success('Successfully scaffolded your project')
    log.info(`cd ${path} && bun install`)
  }
  catch (error) {
    log.error('There was an error creating your stack', error)
    process.exit()
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
  const path = p.userModelsPath(`${name}.ts`)

  try {
    await createFileWithTemplate(path, 'model', name)

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
