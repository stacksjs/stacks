import { afterEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'

// Mock logging to prevent process hanging
mock.module('@stacksjs/logging', () => ({
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  },
}))

const { makeJob } = await import('../src/make-job')
const { userJobsPath } = await import('@stacksjs/path')
const { get } = await import('@stacksjs/storage')

// Track created files for cleanup
const createdFiles: string[] = []

function cleanup() {
  for (const file of createdFiles) {
    try {
      if (existsSync(file)) unlinkSync(file)
    }
    catch {}
  }
  createdFiles.length = 0
}

afterEach(cleanup)

describe('makeJob', () => {
  describe('job creation', () => {
    it('should create a function-based job file', async () => {
      const result = await makeJob({ name: 'TestMakeJob' })

      const filePath = userJobsPath('TestMakeJob.ts')
      createdFiles.push(filePath)

      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(true)
    })

    it('should append Job suffix if not present', async () => {
      const result = await makeJob({ name: 'SendEmail' })

      const filePath = userJobsPath('SendEmailJob.ts')
      createdFiles.push(filePath)

      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(true)
    })

    it('should not double-suffix if name already ends with Job', async () => {
      const result = await makeJob({ name: 'CleanupJob' })

      const filePath = userJobsPath('CleanupJob.ts')
      createdFiles.push(filePath)

      expect(result).toBe(true)
      expect(existsSync(filePath)).toBe(true)

      // Should NOT create CleanupJobJob.ts
      expect(existsSync(userJobsPath('CleanupJobJob.ts'))).toBe(false)
    })

    it('should return false when name is missing', async () => {
      const result = await makeJob({ name: '' })
      expect(result).toBe(false)
    })
  })

  describe('function-based job content', () => {
    it('should generate valid Job import and constructor', async () => {
      await makeJob({ name: 'ProcessOrder' })

      const filePath = userJobsPath('ProcessOrderJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)

      expect(content).toContain("import { Job } from '@stacksjs/queue'")
      expect(content).toContain('export default new Job({')
    })

    it('should include job name', async () => {
      await makeJob({ name: 'SendReport' })

      const filePath = userJobsPath('SendReportJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("name: 'SendReportJob'")
    })

    it('should include default queue, tries, and backoff', async () => {
      await makeJob({ name: 'DefaultsCheck' })

      const filePath = userJobsPath('DefaultsCheckJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("queue: 'default'")
      expect(content).toContain('tries: 3')
      expect(content).toContain('backoff: 3')
    })

    it('should include handle method', async () => {
      await makeJob({ name: 'HandleCheck' })

      const filePath = userJobsPath('HandleCheckJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain('async handle(payload: any)')
      expect(content).toContain('return { success: true }')
    })

    it('should include commented-out rate and backoffConfig examples', async () => {
      await makeJob({ name: 'ExamplesCheck' })

      const filePath = userJobsPath('ExamplesCheckJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("// rate: '* * * * *'")
      expect(content).toContain('// backoffConfig:')
    })
  })

  describe('class-based job content', () => {
    it('should generate a class-based job when --class flag is set', async () => {
      await makeJob({ name: 'ClassBased', class: true } as any)

      const filePath = userJobsPath('ClassBasedJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)

      expect(content).toContain('export default class ClassBasedJob')
      expect(content).toContain('public static config')
      expect(content).toContain('public static async handle')
    })

    it('should include static config in class-based job', async () => {
      await makeJob({ name: 'ClassConfig', class: true } as any)

      const filePath = userJobsPath('ClassConfigJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("queue: 'default'")
      expect(content).toContain('withoutOverlapping: false')
      expect(content).toContain('timeout: 60')
      expect(content).toContain('retries: 3')
      expect(content).toContain('retryAfter: [60, 120, 300]')
    })
  })

  describe('custom options', () => {
    it('should respect custom queue name', async () => {
      await makeJob({ name: 'CustomQueue', queue: 'emails' } as any)

      const filePath = userJobsPath('CustomQueueJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain("queue: 'emails'")
    })

    it('should respect custom tries count', async () => {
      await makeJob({ name: 'CustomTries', tries: 5 } as any)

      const filePath = userJobsPath('CustomTriesJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain('tries: 5')
    })

    it('should respect custom backoff value', async () => {
      await makeJob({ name: 'CustomBackoff', backoff: 10 } as any)

      const filePath = userJobsPath('CustomBackoffJob.ts')
      createdFiles.push(filePath)

      const content = await get(filePath)
      expect(content).toContain('backoff: 10')
    })
  })
})
