import { afterAll, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test'
import { italic } from '@stacksjs/cli'
import fs from 'fs-extra'
import { ErrorHandler, handleError } from '../src/handler'
import { rescue } from '../src/utils'

describe('@stacksjs/error-handling', () => {
  let originalConsoleError: typeof console.error
  let originalConsoleLog: typeof console.log
  let originalProcessExit: typeof process.exit

  beforeAll(() => {
    originalConsoleError = console.error
    console.error = () => {} // No-op function

    // eslint-disable-next-line no-console
    originalConsoleLog = console.log
    // eslint-disable-next-line no-console
    console.log = () => {} // No-op function

    originalProcessExit = process.exit
    process.exit = () => {
      throw new Error('process.exit() was called')
    }

    ErrorHandler.isTestEnvironment = true
    ErrorHandler.shouldExitProcess = false
  })

  afterAll(() => {
    console.error = originalConsoleError
    // eslint-disable-next-line no-console
    console.log = originalConsoleLog
    process.exit = originalProcessExit
    ErrorHandler.isTestEnvironment = false
    ErrorHandler.shouldExitProcess = true
  })

  describe('ErrorHandler', () => {
    it('should handle string errors', () => {
      const error = 'Test error'
      const handledError = ErrorHandler.handle(error)
      expect(handledError).toBeInstanceOf(Error)
      expect(handledError.message).toBe(error)
    })

    it('should handle Error objects', () => {
      const error = new Error('Test error')
      const handledError = ErrorHandler.handle(error)
      expect(handledError).toBe(error)
    })

    it('should handle non-Error objects', () => {
      const nonError = { message: 'Not an Error' }
      const handledError = ErrorHandler.handle(nonError)
      expect(handledError).toBeInstanceOf(Error)
      expect(handledError.message).toBe(JSON.stringify(nonError))
    })

    it('should write error to console when not silent', () => {
      const consoleErrorSpy = spyOn(console, 'error')
      const error = new Error('Test error')
      ErrorHandler.handle(error, { silent: false })
      expect(consoleErrorSpy).toHaveBeenCalledWith(error)
      consoleErrorSpy.mockRestore()
    })

    it('should not write error to console when silent', () => {
      const consoleErrorSpy = spyOn(console, 'error')
      const error = new Error('Test error')
      ErrorHandler.handle(error, { silent: true })
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should write error to file', async () => {
      const appendFileSpy = spyOn(fs, 'appendFile').mockResolvedValue(undefined)
      const error = new Error('Test error')
      await ErrorHandler.writeErrorToFile(error)
      expect(appendFileSpy).toHaveBeenCalled()
      appendFileSpy.mockRestore()
    })

    it('should handle specific command errors', () => {
      const consoleErrorSpy = spyOn(console, 'error')
      const consoleLogSpy = spyOn(console, 'log')

      const error = 'Failed to execute command: bunx --bun cdk destroy'
      ErrorHandler.writeErrorToConsole(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(error)
      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should format error message correctly when writing to file', async () => {
      const appendFileSpy = spyOn(fs, 'appendFile').mockResolvedValue(undefined)
      const error = new Error('Test error')
      await ErrorHandler.writeErrorToFile(error)
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] Error: Test error\n$/),
      )
      appendFileSpy.mockRestore()
    })

    it('should handle CDK destroy command errors', () => {
      const consoleErrorSpy = spyOn(console, 'error')
      const consoleLogSpy = spyOn(console, 'log')

      const error = 'Failed to execute command: bunx --bun cdk destroy'
      ErrorHandler.writeErrorToConsole(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(error)
      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should handle eslint check command errors', () => {
      const consoleErrorSpy = spyOn(console, 'error')
      const consoleLogSpy = spyOn(console, 'log')

      const error = `Failed to execute command: ${italic('bunx --bun eslint . --fix')}`
      ErrorHandler.writeErrorToConsole(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(error)
      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should handle lint fix command errors', () => {
      const consoleErrorSpy = spyOn(console, 'error')
      const consoleLogSpy = spyOn(console, 'log')

      const error = `Failed to execute command: ${italic('bun storage/framework/core/actions/src/lint/fix.ts')}`
      ErrorHandler.writeErrorToConsole(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(error)
      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should use correct log file path', async () => {
      const mkdirSpy = spyOn(fs, 'mkdir').mockResolvedValue(undefined)
      const appendFileSpy = spyOn(fs, 'appendFile').mockResolvedValue(undefined)
      const error = new Error('Test error')
      await ErrorHandler.writeErrorToFile(error)
      expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining('logs'), expect.anything())
      expect(appendFileSpy.mock.calls[0][0]).toMatch(/logs[/\\]stacks\.log$/)
      mkdirSpy.mockRestore()
      appendFileSpy.mockRestore()
    })
  })

  describe('Utils', () => {
    describe('handleError function', () => {
      it('should handle string errors', () => {
        const error = 'Test error'
        const handledError = handleError(error)
        expect(handledError).toBeInstanceOf(Error)
        expect(handledError.message).toBe(error)
      })

      it('should handle Error objects', () => {
        const error = new Error('Test error')
        const handledError = handleError(error)
        expect(handledError).toBe(error)
      })

      it('should handle unknown objects', () => {
        const unknown = { foo: 'bar' }
        const handledError = handleError(unknown)
        expect(handledError).toBeInstanceOf(Error)
        expect(handledError.message).toBe(JSON.stringify(unknown))
      })
    })

    describe('rescue function', () => {
      it('should return the result of the function if no error occurs', () => {
        const result = rescue(() => 42, 0)
        expect(result).toBe(42)
      })

      it('should return the fallback value if an error occurs', () => {
        const result = rescue(() => {
          throw new Error('Test error')
        }, 0)
        expect(result).toBe(0)
      })

      it('should handle async functions', async () => {
        const result = await rescue(async () => {
          throw new Error('Async error')
        }, 'fallback')
        expect(result).toBe('fallback')
      })

      it('should pass error to onError callback if provided', () => {
        const onErrorMock = mock(() => {})
        rescue(
          () => {
            throw new Error('Test error')
          },
          0,
          onErrorMock,
        )
        expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error))
      })

      it('should handle successful async operations', async () => {
        const result = await rescue(async () => 'async result', 'fallback')
        expect(result).toBe('async result')
      })
    })
  })

  describe('ErrorHandling Index', () => {
    it('should export ErrorHandler', () => {
      expect(ErrorHandler).toBeDefined()
    })

    it('should export handleError', () => {
      expect(handleError).toBeDefined()
    })

    it('should export rescue', () => {
      expect(rescue).toBeDefined()
    })
  })
})
