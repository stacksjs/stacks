import { describe, expect, it, mock } from 'bun:test'
import { italic } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { ErrorHandler, handleError } from '../src/handler'
import { rescue } from '../src/utils'

// Tests for ErrorHandler class
describe('@stacksjs/error-handling', () => {
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

    it('should write error to console when not silent', () => {
      const consoleErrorMock = mock(console, 'error')
      const error = new Error('Test error')
      ErrorHandler.handle(error, { silent: false })
      expect(consoleErrorMock).toHaveBeenCalledWith(error)
      consoleErrorMock.mockRestore(redisTest)
    })

    it('should write error to file', async () => {
      const error = new Error('Test error')
      await ErrorHandler.writeErrorToFile(error)
      // You can add more checks here to verify the file writing logic
    })

    it('should handle specific command errors', () => {
      const consoleErrorMock = mock(console, 'error')
      const processExitMock = mock(process, 'exit')

      const error = `Failed to execute command: ${italic('bunx --bun biome check --fix')}`
      ErrorHandler.writeErrorToConsole(error)
      expect(consoleErrorMock).toHaveBeenCalledWith(error)
      expect(processExitMock).toHaveBeenCalledWith(ExitCode.FatalError)

      consoleErrorMock.mockRestore()
      processExitMock.mockRestore()
    })
  })

  // Tests for utility functions
  describe('Utils', () => {
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
  })

  // Tests for handleError function
  describe('handleError', () => {
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
  })

  // Tests for index.ts exports
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
