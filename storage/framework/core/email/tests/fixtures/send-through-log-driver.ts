/**
 * Sends one message through the log driver from whatever project the
 * working directory is, then prints where the driver says captures go.
 * Used by `log-driver-directory.test.ts`.
 */
import process from 'node:process'
import { LogEmailDriver } from '../../src/drivers/log'

const result = await new LogEmailDriver().send({ from: { address: 'app@example.test' }, to: 'ada@example.test', subject: 'Captured here', text: 'hello' } as never)
console.log(JSON.stringify({ success: result.success, directory: LogEmailDriver.directory() }))
process.exit(0)
