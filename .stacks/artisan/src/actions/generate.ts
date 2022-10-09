import consola from 'consola'
import { NpmScript } from '../../../core/types'
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
    await runNpmScript(NpmScript.GenerateEntries)
    consola.success('Library entry points were generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating your library entry points.')
    consola.error(error)
  }
}

export async function generateVueCompat() {
  try {
    await runNpmScript(NpmScript.GenerateVueCompat)
    consola.success('Vue 2 & 3 compatibility was generated successfully.')
  }
  catch (error) {
    consola.error('There was an error generating Vue compatibility.')
    consola.error(error)
  }
}

export async function generateWebTypes() {
  try {
    await runNpmScript(NpmScript.GenerateVueCompat)
    consola.success('Successfully generated web-types.json.')
  }
  catch (error) {
    consola.error('There was an error generating web-types.json')
    consola.error(error)
  }
}
