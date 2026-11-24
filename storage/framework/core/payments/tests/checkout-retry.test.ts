import { expect, test } from 'bun:test'

test('Stripe reuses the session for a checkout attempt and gives new attempts fresh keys', async () => {
  const child = Bun.spawn(
    [process.execPath, '--config=/dev/null', '--no-env-file', `${import.meta.dir}/fixtures/checkout-retry.ts`],
    {
      env: { ...process.env, APP_URL: 'https://app.example.test', STRIPE_SECRET_KEY: 'sk_test_checkout_retry_fixture' },
      stdout: 'ignore',
      stderr: 'pipe',
    },
  )
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(exitCode, stderr).toBe(0)
})
