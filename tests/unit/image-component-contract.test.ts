import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const imageComponent = readFileSync(
  resolve('storage/framework/defaults/resources/components/Image.stx'),
  'utf8',
)

describe('the default Image component', () => {
  test('delegates delivery to the STX image builtin', () => {
    expect(imageComponent).toContain('<StxImage')
    expect(imageComponent).not.toContain('<img')
    expect(imageComponent).not.toContain('<picture')
  })

  test('keeps accessibility and delivery controls on its public surface', () => {
    expect(imageComponent).toContain('Image alt text is required unless decorative is true')
    expect(imageComponent).toContain('@if(props.priority) priority @endif')
    expect(imageComponent).toContain('@if(placeholder) placeholder="{{ placeholder }}" @endif')
  })
})
