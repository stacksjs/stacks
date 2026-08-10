import { describe, expect, it } from 'bun:test'
import { publicApplicationUrl } from './public-application-url'

describe('publicApplicationUrl', () => {
  it('uses HTTPS for application domains and removes duplicate separators', () => {
    expect(publicApplicationUrl('/blog', 'stacks.localhost/')).toBe('https://stacks.localhost/blog')
    expect(publicApplicationUrl('/blog/post', 'https://stacksjs.com/')).toBe('https://stacksjs.com/blog/post')
  })

  it('keeps explicit local development protocols', () => {
    expect(publicApplicationUrl('/blog', 'http://localhost:3000')).toBe('http://localhost:3000/blog')
  })
})
