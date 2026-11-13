import { describe, expect, test } from 'bun:test'
import { confirmationCode, confirmationMatches, hashConnectCode } from '../src/service'

const CODE = '6rKvL4SxrZnDT3j-VwO8wdaIPibVc9gtrHoujMoDHdc'
const OTHER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('the confirmation code', () => {
  test('is short, readable, and the same every time for one connect code', async () => {
    const code = await confirmationCode(CODE)
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3}$/)
    expect(await confirmationCode(CODE)).toBe(code)
  })

  test('differs between connect codes', async () => {
    const codes = new Set(await Promise.all(Array.from({ length: 200 }, (_, i) => confirmationCode(`${CODE}${i}`))))
    expect(codes.size).toBeGreaterThan(195)
    expect(await confirmationCode(OTHER)).not.toBe(await confirmationCode(CODE))
  })

  test('is not the hash the store keeps, nor a piece of the connect code', async () => {
    const confirm = (await confirmationCode(CODE)).replace('-', '').toLowerCase()
    expect((await hashConnectCode(CODE)).startsWith(confirm)).toBe(false)
    expect(CODE.toLowerCase()).not.toContain(confirm)
  })

  test('matches what a person would type, however they type it', async () => {
    const code = await confirmationCode(CODE)
    for (const typed of [code, code.toLowerCase(), code.replace('-', ''), ` ${code} `, code.replace('-', ' ')])
      expect(await confirmationMatches(CODE, typed)).toBe(true)
  })

  test('refuses anything else', async () => {
    const code = await confirmationCode(CODE)
    for (const typed of [undefined, null, '', 'ABC-DEF', code.slice(0, 5), `${code}X`, await confirmationCode(OTHER), true, 123456, [code], { code }])
      expect(await confirmationMatches(CODE, typed)).toBe(false)
  })
})
