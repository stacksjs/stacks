import process from 'node:process'
import { runDaemon } from './server'

// The daemon's entry: `startDaemon` in ./client runs this file detached.
await runDaemon()
process.exit(0)
