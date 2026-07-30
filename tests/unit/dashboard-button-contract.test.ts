import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard button contract', () => {
  test('uses one canonical reusable button component', () => {
    const button = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/UI/Button.stx'),
      'utf8',
    )

    expect(existsSync(resolve('storage/framework/defaults/resources/components/Button.stx'))).toBe(false)
    expect(existsSync(resolve('storage/framework/defaults/resources/components/Buttons/BaseButton.stx'))).toBe(false)
    expect(button).toContain('bg-gradient-to-b from-blue-500 to-blue-600')
    expect(button).toContain("variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'")
    expect(button).toContain("tag?: 'button' | 'a'")
    expect(button).toContain("const liveDownload = useReactiveProp('download', '')")
  })
})
