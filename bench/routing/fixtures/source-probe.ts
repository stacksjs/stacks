import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const hasImporter = args[0] === '--importer'
const parent = hasImporter ? import.meta.resolve(args[1]!) : import.meta.url
const specifiers = hasImporter ? args.slice(2) : args
const modules = Object.fromEntries(specifiers.map(specifier => [
  specifier,
  fileURLToPath(import.meta.resolve(specifier, parent)),
]))

console.log(JSON.stringify(modules))
