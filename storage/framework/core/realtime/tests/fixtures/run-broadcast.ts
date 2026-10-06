// Runs broadcasts by name in the temp project this runs inside and reports
// which file each name ran, or the error. For run-broadcast.test.ts.
const { runBroadcast } = await import('../../src/broadcast')

const outcomes: Record<string, string> = {}
for (const name of JSON.parse(process.argv[2]!) as string[]) {
  try {
    ;(globalThis as { ran?: string }).ran = undefined
    await runBroadcast(name)
    outcomes[name] = `ran ${(globalThis as { ran?: string }).ran}`
  }
  catch (error) {
    outcomes[name] = `error ${(error as Error).message}`
  }
}
console.log(JSON.stringify(outcomes))
process.exit(0)
