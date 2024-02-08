export function retry(fn, options) {
  const { retries = 3, initialDelay = 1000, backoffFactor = 2, jitter = true } = options

  return new Promise((resolve, reject) => {
    let attemptCount = 0
    const attempt = async () => {
      try {
        resolve(await fn())
      }
      catch (err) {
        if (attemptCount >= retries) {
          reject(err)
        }
        else {
          const delay = calculateDelay(attemptCount, initialDelay, backoffFactor, jitter)
          setTimeout(() => attempt(), delay)
          attemptCount++
        }
      }
    }
    attempt()
  })
}

function calculateDelay(attemptCount, initialDelay, backoffFactor, jitter) {
  let delay = initialDelay * backoffFactor ** attemptCount
  if (jitter) {
    const random = Math.random() // Generates a number between 0 and 1
    const jitterValue = delay * 0.3 // Jitter will be up to 30% of the delay
    delay = delay + jitterValue * (random - 0.5) * 2 // Adjust delay randomly within ±30%
  }
  return delay
}
