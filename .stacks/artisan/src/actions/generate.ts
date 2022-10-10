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
    await runNpmScript(NpmScript.GenerateWebTypes)
    consola.success('Successfully generated the web-types.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the web-types.json file')
    consola.error(error)
  }
}

export async function generateVsCodeCustomData() {
  try {
    await runNpmScript(NpmScript.GenerateVsCodeCustomData)
    consola.success('Successfully generated the custom-elements.json file.')
  }
  catch (error) {
    consola.error('There was an error generating the custom-elements.json file')
    consola.error(error)
  }
}
