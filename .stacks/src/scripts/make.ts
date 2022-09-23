import { resolve } from 'pathe'
import consola from 'consola'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { writeTextFile } from '../core/fs'

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

export async function fx(name: string) {
  consola.info('Creating your function...')

  try {
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

    consola.success(`Created the ${name} function.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function language(language: string) {
  consola.info('Creating your translation file...')

  try {
    await writeTextFile({
      path: `./lang/${language}.yml`,
      data: `button:
  text: Copy
`,
    })

    consola.success(`Created the ${language} translation file.`)
  }
  catch (err) {
    consola.error(err)
  }
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
