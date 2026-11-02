import { expect, test } from 'bun:test'
import { UploadedFile } from '../src/uploaded-file'

test('MIME wildcards match a complete category and its slash', () => {
  const file = (type: string) => new UploadedFile(new File(['bytes'], 'upload', { type }))
  expect(file('image/png').isOneOf(['image/*'])).toBe(true)
  expect(file('imageevil/x').isOneOf(['image/*'])).toBe(false)
  expect(file('images/png').isOneOf(['image/*'])).toBe(false)
  expect(file('image').isOneOf(['image/*'])).toBe(false)
  expect(file('application/pdf').isOneOf(['image/*', 'application/pdf'])).toBe(true)
})
