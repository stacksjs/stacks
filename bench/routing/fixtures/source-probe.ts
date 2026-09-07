import { fileURLToPath } from 'node:url'

const modules = Object.fromEntries(process.argv.slice(2).map(specifier => [
  specifier,
  fileURLToPath(import.meta.resolve(specifier)),
]))

console.log(JSON.stringify(modules))
