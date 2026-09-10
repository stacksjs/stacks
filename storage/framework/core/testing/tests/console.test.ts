/**
 * Running a buddy command in a test (stacksjs/stacks#2581).
 *
 * The argument splitting and the builder are unit-tested; actually spawning
 * `./buddy` is not. A buddy command writes `storage/framework/runtime` and
 * `storage/cloud` on startup, and a test in this repository that spawned one
 * broke five consecutive CI runs by racing another package's fixtures
 * (stacksjs/stacks#2576). The helper exists so an APPLICATION can test its own
 * commands; the framework's suite has no business running them.
 */

import { describe, expect, it } from 'bun:test'
import { command, splitCommand } from '../src/console'

describe('splitCommand', () => {
  it('splits on whitespace', () => {
    expect(splitCommand('make:model Post --migration')).toEqual(['make:model', 'Post', '--migration'])
  })

  it('keeps a quoted argument together', () => {
    // Without this, anything taking a message is silently several arguments.
    expect(splitCommand('commit -m "two words"')).toEqual(['commit', '-m', 'two words'])
    expect(splitCommand("commit -m 'two words'")).toEqual(['commit', '-m', 'two words'])
  })

  it('keeps an empty quoted argument, which is not nothing', () => {
    expect(splitCommand('greet ""')).toEqual(['greet', ''])
  })

  it('honours an escape', () => {
    expect(splitCommand('greet two\\ words')).toEqual(['greet', 'two words'])
  })

  it('collapses runs of whitespace', () => {
    expect(splitCommand('  greet   John  ')).toEqual(['greet', 'John'])
  })

  it('refuses an unterminated quote rather than guessing', () => {
    expect(() => splitCommand('commit -m "unfinished')).toThrow(/Unterminated/)
  })

  it('answers empty for an empty string', () => {
    expect(splitCommand('   ')).toEqual([])
  })
})

describe('command', () => {
  it('is lazy, so the chain applies before anything runs', () => {
    // A promise would start on construction and the `withEnv` below would
    // arrive too late to matter. Nothing here spawns.
    const builder = command('greet').withEnv({ APP_ENV: 'testing' }).withInput(['yes'])
    expect(typeof builder.then).toBe('function')
  })

  it('returns itself from every chained call', () => {
    const builder = command('greet')
    expect(builder.withEnv({ A: '1' })).toBe(builder)
    expect(builder.withInput(['y'])).toBe(builder)
    expect(builder.withCwd('/tmp')).toBe(builder)
    expect(builder.withTimeout(1000)).toBe(builder)
  })

  it('rejects a timeout that is not a positive number', () => {
    // Zero or negative would kill the process before it started, reporting a
    // timeout for a command that never ran.
    expect(() => command('greet').withTimeout(0)).toThrow(TypeError)
    expect(() => command('greet').withTimeout(-1)).toThrow(TypeError)
    expect(() => command('greet').withTimeout(Number.NaN)).toThrow(TypeError)
  })

  it('accepts argv directly, for an argument with spaces in it', () => {
    // The string form has to be split; the array form does not, which is the
    // escape hatch when quoting would get fiddly.
    const builder = command(['commit', '-m', 'two words'])
    expect(typeof builder.then).toBe('function')
  })

  it('refuses to run nothing', async () => {
    // `expect().rejects` wants a real Promise and the builder is a thenable,
    // so this awaits it rather than handing the builder over.
    await expect((async () => await command('   '))()).rejects.toThrow(/needs something to run/)
  })
})
