import { describe, expect, it } from 'bun:test'
import { generateWebTypesData } from '../src/helpers/vscode-custom-data'

describe('STX web types', () => {
  it('generates STX component sources without legacy template paths', async () => {
    const parsed = JSON.parse(await generateWebTypesData())

    expect(parsed.framework).toBe('stx')
    expect(parsed.contributions.html.tags.every((tag: { source: { module: string } }) => tag.source.module.endsWith('.stx'))).toBe(true)
  })

  it('reads config that has finished loading, so the tags are not empty', async () => {
    /*
     * `library` is a `let` in @stacksjs/config that starts on the empty-default
     * snapshot, so reading it synchronously produced a valid but EMPTY
     * web-types.json - and the `?? []` guard made that failure silent
     * (stacksjs/stacks#2411). Awaiting the overrides is what fills it in.
     */
    const parsed = JSON.parse(await generateWebTypesData())

    expect(parsed.name).toBeTruthy()
    expect(parsed.contributions.html.tags.length).toBeGreaterThan(0)
  })
})
