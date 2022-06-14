/**
 * Thanks: https://github.com/vitebook/vitebook/blob/main/scripts/run-example.js
 */

import { spawn } from 'child_process'
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { prompts } from 'prompts'
import { dirname, relative, resolve } from 'pathe'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2))

const __dirname = dirname(fileURLToPath(import.meta.url))
const examplesDir = resolve(__dirname, '../examples')

const examples = readdirSync(examplesDir).filter(
  dirName => !dirName.startsWith('.'),
)

const exampleArg = args._[0]

const exampleArgIndex = examples.findIndex(example => example === exampleArg)

const exampleIndex
    = exampleArgIndex >= 0
      ? exampleArgIndex
      : await prompts.select({
        message: 'Pick an example',
        choices: examples,
        initial: 0,
      })

const example = examples[exampleIndex]
const exampleDir = resolve(examplesDir, example)
const relativePathToExample = relative(process.cwd(), exampleDir)
const examplePkgPath = resolve(exampleDir, 'package.json')
const examplePkgContent = JSON.parse(readFileSync(examplePkgPath).toString())

const scripts = Object.keys(examplePkgContent)
const scriptArg = args.script
const scriptArgIndex = scripts.findIndex(script => script === scriptArg)

const scriptIndex
    = scriptArgIndex >= 0
      ? scriptArgIndex
      : await prompts.select({
        message: 'Pick a script',
        choices: scripts,
        initial: 0,
      })

const script = scripts[scriptIndex]

spawn('npm', ['run', script, `--prefix=${relativePathToExample}`], {
  stdio: 'inherit',
})
