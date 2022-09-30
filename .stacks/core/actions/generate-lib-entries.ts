#!/usr/bin/env node
import { resolve } from 'pathe'
import consola from 'consola'
import { hasComponents, hasFunctions, writeTextFile } from '..'

/**
 * Based on the config values, this method
 * will generate the library entry points.
 * @param type
 */
export async function generateLibEntry(type: 'components' | 'functions') {
  consola.info('Creating the library entry points...')

  const path = resolve(process.cwd(), `../../core/build/entries/${type}.ts`)

  try {
    await writeTextFile({
      path,
      data: `export { default as Counter } from '../components/Buttons/Counter.vue'
export { default as ToggleDark } from '../components/Buttons/ToggleDark.vue'
export { default as Logo } from '../components/Logo.vue'
export { default as HelloWorld } from '../components/HelloWorld.vue'
export { default as Demo } from '../components/Demo.vue'
`,
    })

    consola.success(`Created the ${type} library entrypoint/s.`)
  }
  catch (err) {
    consola.error(err)
  }
}

export async function generate() {
  if (hasComponents())
    await generateLibEntry('components')

  if (hasFunctions())
    await generateLibEntry('functions')
}

generate()
