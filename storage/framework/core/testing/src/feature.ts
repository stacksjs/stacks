import process from 'node:process'

export function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test'
  process.env.APP_ENV = 'test'
}
