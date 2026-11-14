import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateMigrations } from '../../../database/src/migrations'

if (realpathSync(process.cwd()) !== realpathSync(resolve(import.meta.dir, 'replay-app'))) throw new Error('Generate replay fixture schema only from its owned application root')
const dialect = process.argv[2]
if (dialect !== 'sqlite' && dialect !== 'postgres') throw new Error('Select sqlite or postgres')
const result = await generateMigrations({ dialect })
if (result.isErr) throw result.error
console.info(result.value)
