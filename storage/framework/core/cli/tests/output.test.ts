import { expect, test } from 'bun:test'

const output = new URL('../src/output.ts', import.meta.url).pathname

test('plain command output survives immediate exit with logging disabled', () => {
  const source = `import { print, printError } from ${JSON.stringify(output)};
    print('value: %s %d', 'α', 7);
    print({ count: 3 });
    print();
    printError('failed: %s', 'reason');
    process.exit(2);`
  const child = Bun.spawnSync([process.execPath, '--no-env-file', '-e', source], {
    env: { ...process.env, LOG_LEVEL: 'error' }, stdout: 'pipe', stderr: 'pipe',
  })
  expect(child.exitCode).toBe(2)
  expect(child.stdout.toString()).toBe('value: α 7\n{ count: 3 }\n\n')
  expect(child.stderr.toString()).toBe('failed: reason\n')
})
