import { runAction } from './src'

const result = await runAction('generate-lib-entries')

if (result.isErr()) {
  console.error(result.error)
  process.exit()
}

// eslint-disable-next-line no-console
console.log(result.value)
