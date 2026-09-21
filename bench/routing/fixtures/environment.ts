import process from 'node:process'

console.log(JSON.stringify({
  sentinel: process.env.BENCH_ENV_SENTINEL ?? null,
  explicit: process.env.BENCH_EXPLICIT_ENV ?? null,
}))
