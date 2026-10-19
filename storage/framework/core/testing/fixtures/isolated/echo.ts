// Prints what the child sees, for tests/isolated.test.ts.
import process from 'node:process'

const mode = process.argv[2]
if (mode === 'hang') await new Promise(() => setInterval(() => {}, 1000))
if (mode === 'stdin') process.stdout.write(await new Response(Bun.stdin.stream()).text())
process.stdout.write(`${JSON.stringify({ argv: process.argv.slice(2), marker: process.env.ISOLATED_MARKER ?? null, removed: process.env.ISOLATED_REMOVED ?? null, preloaded: (globalThis as any).__preloaded ?? null })}\n`)
process.stderr.write('to stderr\n')
if (mode === 'fail') process.exit(3)
