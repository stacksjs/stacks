import { spawn } from 'node:child_process'
import process from 'node:process'

// Define the redisProcess variable to hold the Redis process
let redisProcess: any | null = null

// Function to start the Redis server using Node's spawn
export async function startRedisServer(): Promise<void> {
  // Check if running in GitHub Actions
  if (process.env.GITHUB_ACTIONS) {
    console.log('Skipping Redis server start in GitHub Actions.')
    return // Skip starting Redis
  }

  return new Promise((resolve, reject) => {
    redisProcess = spawn('redis-server', {
      stdio: 'pipe',
    })

    redisProcess.stdout.on('data', (data: Error) => {
      console.log(`Redis server output: ${data}`)
      // Optionally resolve if you detect the server is ready
      if (data.toString().includes('Ready to accept connections')) {
        resolve()
      }
    })

    redisProcess.stderr.on('data', (data: Error) => {
      console.error(`Redis server error: ${data}`)
      reject(new Error(`Redis server error: ${data}`))
    })

    redisProcess.on('exit', (code: number) => {
      console.log(`Redis server process exited with code ${code}`)
      if (code !== 0) {
        reject(new Error(`Redis server exited with code ${code}`))
      }
    })

    console.log('Starting Redis server...')
  })
}

// Function to stop Redis by killing the process
export function stopRedisServer(): void {
  // Check if running in GitHub Actions
  if (process.env.GITHUB_ACTIONS) {
    console.log('Skipping Redis server stop in GitHub Actions.')
    return // Skip stopping Redis
  }

  if (redisProcess) {
    redisProcess.kill() // Kills the Redis process
    console.log('Redis server process killed.')
    redisProcess = null // Reset the process variable
  }
  else {
    console.log('Redis server is not running.')
  }
}
