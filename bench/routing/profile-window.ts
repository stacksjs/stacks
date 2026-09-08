import { profile } from 'bun:jsc'

/** Begin sampling only once warm-up has completed, and stop before artifact IO. */
export async function captureCpuWindow(start: Promise<void>, stop: Promise<void>, started: () => void) {
  await start
  return profile(async () => {
    started()
    await stop
  }, 1000)
}
