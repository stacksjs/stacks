import consola from 'consola'
import { NpmScript } from '../../../core'
import { runNpmScript } from './run-npm-script'

export async function generateTypes() {
  try {
    await runNpmScript(NpmScript.GenerateTypes)
    consola.success('Types were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your types.')
    consola.error(error)
  }
}

export async function generateLibEntries() {
  try {
    await runNpmScript(NpmScript.generateEntries)
    consola.success('Library entry points were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your library entry points.')
    consola.error(error)
  }
}

export async function generateVueCompat() {
  try {
    await runNpmScript(NpmScript.generateVueCompat)
    consola.success('Vue 2 & 3 compatibility was generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating Vue compatibility.')
    consola.error(error)
  }
}
