import process from 'node:process'

if (process.argv[2] !== 'check') {
  // Bound a broken readiness probe so the test cannot leave a server running.
  setTimeout(() => process.exit(1), 10_000).unref()
  await import('../servers/stacks')
}
else {
  const { assertParity, boot, stop } = await import('../runtime')
  const { scenarioById } = await import('../scenarios')
  const { targetById } = await import('../targets')
  // 'all' exercises the default boot path with no selected scenario.
  const scenario = scenarioById(process.argv[3]!)
  const target = { ...targetById('stacks-warm')!, server: '../fixtures/readiness.ts' }
  const server = await boot(target, false, scenario)
  if ('skipped' in server) throw new Error(server.skipped)
  try {
    await assertParity(target, scenario ?? scenarioById('static-json')!)
    await Bun.write(Bun.stdout, 'benchmark-readiness-ok\n')
  }
  finally {
    await stop(server)
  }
}
