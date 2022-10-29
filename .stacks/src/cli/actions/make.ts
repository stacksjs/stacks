import consola from 'consola'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { writeTextFile } from '@stacksjs/storage'
import { resolve } from '@stacksjs/path'

export async function component(name: string) {
  consola.info('Creating your component...')

  try {
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

    consola.success(`Created the ${name} component.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function page(name: string) {
  try {
    consola.info('Creating your component...')
    createPage(name)
    consola.success(`Created the ${name} page.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function createPage(name: string) {
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

export async function fx(name: string) {
  try {
    consola.info('Creating your function...')
    createFunction(name)
    consola.success(`Created the ${name} function.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function createFunction(name: string) {
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

export async function language(language: string) {
  try {
    consola.info('Creating your translation file...')
    createLanguage(language)
    consola.success(`Created the ${language} translation file.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function createLanguage(language: string) {
  await writeTextFile({
    path: `./lang/${language}.yml`,
    data: `button:
  text: Copy
`,
  })
}

export async function stack(name: string) {
  consola.info('Creating your stack...')

  try {
    const path = resolve(process.cwd(), name)
    await ezSpawn.async(`giget stacks ${path}`)
    consola.success('Successfully scaffolded your project.')
    consola.info(`cd ${path} && pnpm install`)
  }
  catch (err) {
    consola.error(err)
  }
}
