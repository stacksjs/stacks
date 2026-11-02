import { describe, expect, it } from 'bun:test'
import { isDataURI, isHSL, isIPRange, isISIN, isISO8601, isLatitude, isLatLong, isLongitude, isStrongPassword, isUUID } from '../src/validators'

describe('values the validators refused', () => {
  it('isHSL takes an hsl() colour, and not the colon its broken pattern wanted', () => {
    expect(isHSL('hsl(120, 100%, 50%)')).toBe(true)
    expect(isHSL('hsl(0,0%,0%)')).toBe(true)
    expect(isHSL('hsl(:120, 100%, 50%)')).toBe(false)
    expect(isHSL('hsl:120, 100%, 50%)')).toBe(false)
  })

  it('isISIN takes real ISINs and refuses a wrong check digit', () => {
    for (const isin of ['US0378331005', 'US5949181045', 'GB0002634946', 'AU0000XVGZA3', 'DE000BAY0017'])
      expect(isISIN(isin)).toBe(true)
    expect(isISIN('US0378331004')).toBe(false)
    expect(isISIN('US0378331006')).toBe(false)
  })

  it('isDataURI takes a data URI without base64, and checks a base64 payload to its end', () => {
    expect(isDataURI('data:text/plain,hello')).toBe(true)
    expect(isDataURI('data:text/plain;charset=utf-8,hello%20world')).toBe(true)
    expect(isDataURI('data:,hello world')).toBe(true)
    expect(isDataURI('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isDataURI('data:text/plain;charset=utf-8;base64,SGVsbG8=')).toBe(true)
    expect(isDataURI('data:;base64,SGVsbG8=!!!')).toBe(false)
    expect(isDataURI('data:text plain,x')).toBe(false)
    expect(isDataURI('data:text/plain')).toBe(false)
  })

  it('isUUID takes versions 6 to 8 and the nil and max UUIDs', () => {
    expect(isUUID(Bun.randomUUIDv7())).toBe(true)
    expect(isUUID('1ef21d2f-1207-6660-8c4f-419efbd44d48')).toBe(true)
    expect(isUUID('320c3d4d-cc00-875b-8ec9-32d5f69181c0')).toBe(true)
    expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(isUUID('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF')).toBe(true)
    // A version 9, and a v7 whose variant is not RFC 9562's.
    expect(isUUID('017f22e2-79b0-9cc3-98c4-dc0c0c07398f')).toBe(false)
    expect(isUUID('017f22e2-79b0-7cc3-c8c4-dc0c0c07398f')).toBe(false)
  })

  it('isStrongPassword counts any symbol, and letters outside A to Z', () => {
    expect(isStrongPassword('Password1~')).toBe(true)
    expect(isStrongPassword('Password1 ')).toBe(true)
    expect(isStrongPassword('Password1£')).toBe(true)
    expect(isStrongPassword('Écoleécole1!')).toBe(true)
    expect(isStrongPassword('NoSymbol123')).toBe(false)
    expect(isStrongPassword('écoleécole1!')).toBe(false)
  })

  it('isISO8601 takes any number of fraction digits', () => {
    expect(isISO8601('2026-01-01T10:00:00.123456Z')).toBe(true)
    expect(isISO8601('2026-01-01T10:00:00.5+05:30')).toBe(true)
    expect(isISO8601('2026-01-01T10:00:00.Z')).toBe(false)
  })
})

describe('junk the validators took', () => {
  it('isLatLong, isLatitude and isLongitude want plain decimal numbers', () => {
    expect(isLatLong('45abc, 90xyz')).toBe(false)
    expect(isLatLong('12.3.4,5')).toBe(false)
    expect(isLatitude('45 degrees')).toBe(false)
    expect(isLatitude('0x10')).toBe(false)
    expect(isLongitude('4.5e1')).toBe(false)
    expect(isLatLong(' 40.7128 , -74.0060 ')).toBe(true)
    expect(isLatLong('+90,-180')).toBe(true)
    expect(isLatitude('-.5')).toBe(true)
  })

  it('isIPRange wants a whole-number prefix length', () => {
    for (const range of ['10.0.0.0/24abc', '10.0.0.0/24.5', '10.0.0.0/-0', '10.0.0.0/ 8', '10.0.0.0/'])
      expect(isIPRange(range)).toBe(false)
    expect(isIPRange('10.0.0.0/0')).toBe(true)
    expect(isIPRange('::1/128')).toBe(true)
  })

  it('isISO8601 refuses a day its month does not have', () => {
    for (const date of ['2026-02-29', '2026-02-30', '2026-04-31T10:00:00Z', '1900-02-29', '2026-01-00'])
      expect(isISO8601(date)).toBe(false)
    expect(isISO8601('2024-02-29')).toBe(true)
    expect(isISO8601('2000-02-29T23:59:59Z')).toBe(true)
  })
})
