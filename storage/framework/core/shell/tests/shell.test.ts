import { describe, expect, it } from 'bun:test'

describe('Shell Module', () => {
  it('should export the $ function from bun', async () => {
    const shellModule = await import('../src/index')
    expect(shellModule.$).toBeDefined()
  })

  it('should have $ as a function/callable', async () => {
    const { $ } = await import('../src/index')
    expect(typeof $).toBe('function')
  })

  it('should execute a basic command via $', async () => {
    const { $ } = await import('../src/index')
    const result = await $`echo hello`.quiet()
    expect(result.text().trim()).toBe('hello')
  })

  it('should capture exit code from successful command', async () => {
    const { $ } = await import('../src/index')
    const result = await $`true`.quiet()
    expect(result.exitCode).toBe(0)
  })

  it('should capture stdout from command execution', async () => {
    const { $ } = await import('../src/index')
    const result = await $`printf "test output"`.quiet()
    expect(result.text()).toBe('test output')
  })
})
