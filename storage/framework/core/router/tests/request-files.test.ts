import { describe, expect, test } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { enhanceRequest } from '../src/stacks-router'

function requestWithFiles(files: Record<string, File | File[]>): EnhancedRequest {
  const request = new Request('https://example.test/uploads', {
    method: 'POST',
  }) as EnhancedRequest
  ;(request as any).files = files
  return enhanceRequest(request)
}

describe('request file helpers', () => {
  test('reads single and multiple uploads by field name', () => {
    const avatar = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    const first = new File(['first'], 'first.txt', { type: 'text/plain' })
    const second = new File(['second'], 'second.txt', { type: 'text/plain' })
    const request = requestWithFiles({
      avatar,
      documents: [first, second],
    })

    expect(request.file('avatar')?.name).toBe('avatar.png')
    expect(request.getFiles('documents').map(file => file.name)).toEqual([
      'first.txt',
      'second.txt',
    ])
    expect(request.getFiles('missing')).toEqual([])
    expect(request.hasFile('documents')).toBe(true)
    expect(request.hasFile('missing')).toBe(false)
  })

  test('returns a keyed snapshot without inventing a files() method', () => {
    const request = requestWithFiles({
      attachment: new File(['report'], 'report.pdf', { type: 'application/pdf' }),
    })
    const snapshot = request.allFiles()

    expect(snapshot.attachment).toBeDefined()
    expect(typeof (request as any).files).toBe('object')
    expect(typeof (request as any).files).not.toBe('function')
  })
})
