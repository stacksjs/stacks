import { italic, log, spawn } from '@stacksjs/cli'
import { createFolder, doesFolderExist, writeTextFile } from '@stacksjs/storage'
import { projectPath, resolve } from '@stacksjs/path'
import type { MakeOptions } from '@stacksjs/types'

export async function invoke(options: MakeOptions) {
  if (options.component)
    await component(options)

  if (options.database)
    await database(options)

  if (options.factory)
    await factory(options)

  if (options.function)
    await fx(options)

  if (options.language)
    await language(options)

  if (options.migration)
    await migration(options)

  if (options.notification)
    await notification(options)

  if (options.page)
    await page(options)

  if (options.stack)
    await stack(options)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function make(options: MakeOptions) {
  return invoke(options)
}

export async function component(options: MakeOptions) {
  try {
    const name = options.name
    log.info('Creating your component...')
    await createComponent(options)
    log.success(`Created the ${italic(name)} component.`)
  }
  catch (error) {
    log.error('There was an error creating your component.', error)
    process.exit()
  }
}

export async function createComponent(options: MakeOptions) {
  const name = options.name
  await writeTextFile({
    path: `./components/${name}.vue`,
    data: `<script setup lang="ts">
// eslint-disable-next-line no-console
console.log('Hello World component created')
</script>

<template>
  <div>
    Some HTML block
  </div>
</template>
`,
  })
}

export async function database(options: MakeOptions) {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} database...`)
    await createDatabase(options)
    log.success(`Created the ${italic(name)} database.`)
  }
  catch (error) {
    log.error('There was an error creating your database.', error)
    process.exit()
  }
}

export async function createDatabase(options: MakeOptions) {
  // eslint-disable-next-line no-console
  console.log('options', options) // wip
}

export async function factory(options: MakeOptions) {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} factory...`)
    await createDatabase(options)
    log.success(`Created the ${italic(name)} factory.`)
  }
  catch (error) {
    log.error('There was an error creating your factory.', error)
    process.exit()
  }
}

export async function createFactory(options: MakeOptions) {
  // eslint-disable-next-line no-console
  console.log('options', options) // wip
}

export async function migration(options: MakeOptions) {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} migration...`)
    await createMigration(options)
    log.success(`Created the ${italic(name)} migration.`)
  }
  catch (error) {
    log.error('There was an error creating your migration.', error)
    process.exit()
  }
}

export async function createMigration(options: MakeOptions) {
  // eslint-disable-next-line no-console
  console.log('options', options) // wip
}

export async function notification(options: MakeOptions) {
  try {
    const name = options.name
    log.info(`Creating your ${italic(name)} notification...`)
    await createNotification(options)
    log.success(`Created the ${italic(name)} notification.`)
  }
  catch (error) {
    log.error('There was an error creating your notification.', error)
    process.exit()
  }
}

export async function page(options: MakeOptions) {
  try {
    const name = options.name
    log.info('Creating your page...')
    createPage(options)
    log.success(`Created the ${name} page.`)
  }
  catch (error) {
    log.error('There was an error creating your page.', error)
    process.exit()
  }
}

export async function createPage(options: MakeOptions) {
  const name = options.name
  await writeTextFile({
    path: `./pages/${name}.vue`,
    data:
`<script setup lang="ts">
// eslint-disable-next-line no-console
console.log('Hello World page created')
</script>

<template>
  <div>
    Visit http://127.0.0.1/${name}
  </div>
</template>
`,
  })
}

export async function fx(options: MakeOptions) {
  try {
    const name = options.name
    log.info('Creating your function...')
    await createFunction(options)
    log.success(`Created the ${name} function.`)
  }
  catch (error) {
    log.error('There was an error creating your function.', error)
    process.exit()
  }
}

export async function createFunction(options: MakeOptions) {
  const name = options.name
  await writeTextFile({
    path: `./functions/${name}.ts`,
    data: `// reactive state
const ${name} = ref(0)

// functions that mutate state and trigger updates
function increment() {
  ${name}.value++
}

export {
  ${name},
  increment,
}
`,
  })
}

export async function language(options: MakeOptions) {
  try {
    const name = options.name
    log.info('Creating your translation file...')
    createLanguage(options)
    log.success(`Created the ${name} translation file.`)
  }
  catch (error) {
    log.error('There was an error creating your language.', error)
    process.exit()
  }
}

export async function createLanguage(options: MakeOptions) {
  const name = options.name
  await writeTextFile({
    path: `./lang/${name}.yml`,
    data: `button:
  text: Copy
`,
  })
}

export async function stack(options: MakeOptions) {
  try {
    const name = options.name
    log.info(`Creating your ${name} stack...`)
    const path = resolve(process.cwd(), name)

    await spawn(`giget stacks ${path}`)
    log.success('Successfully scaffolded your project')
    log.info(`cd ${path} && pnpm install`)
  }
  catch (error) {
    log.error('There was an error creating your stack.', error)
    process.exit()
  }
}

export async function createNotification(options: MakeOptions) {
  const name = options.name
  try {
    let importOption = 'EmailOptions'

    if (!doesFolderExist('notifications'))
      await createFolder('./notifications')

    if (options.chat)
      importOption = 'ChatOptions'

    if (options.sms)
      importOption = 'SMSOptions'

    await writeTextFile({
      path: `./notifications/${name}.ts`,
      data: `import type { ${importOption} } from \'@stacksjs/types\'

function content(): string {
  return 'example'
}

function send(): ${importOption} {
  return {
    content: content(),
  }
}`,
    })

    return true
  }
  catch (error) {
    return false
  }
}

export async function createModel(options: MakeOptions) {
  const optionName = options.name
  const name = optionName[0].toUpperCase() + optionName.slice(1)
  const path = projectPath(`app/models/${name}.ts`)
  try {
    await writeTextFile({
      path: `${path}`,
      data: `import { faker } from '../../.stacks/core/faker/src' // stacks/faker or @stacksjs/faker
import { validate } from '../../.stacks/core/validation/src' // stacks/validate or @stacksjs/validate
import type { Model } from '../../.stacks/core/types/src' // stacks/types or @stacksjs/types

export default <Model> {
  name: '${name}',
  searchable: true, // boolean | IndexSettings,
  authenticatable: true, // boolean | AuthSettings,
  seeder: {
    count: 10,
  },
  fields: {
    name: {
      type: 'String',
      validation: validate.string().min(3).max(255),
      factory: () => faker.name,
    },
    // more fields here
  },
}`,})

    log.success(`Successfully created your model at /config/models/${name}.ts`)
  }
  catch (error) {
    log.error(error)
  }
}
