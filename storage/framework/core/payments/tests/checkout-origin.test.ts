import { afterEach, expect, test } from 'bun:test'
import { config } from '@stacksjs/config'
import { assertSameOriginUrl } from '../src/billable/checkout'

const originalApp = config.app.url
const originalOrigins = config.payment.checkoutReturnOrigins
afterEach(() => {
  config.app.url = originalApp
  config.payment.checkoutReturnOrigins = originalOrigins
})

test('separate first-party checkout returns require an explicit trusted origin', () => {
  config.app.url = 'https://api.example.com'
  config.payment.checkoutReturnOrigins = []
  expect(() => assertSameOriginUrl('https://api.example.com/return?subscription=7', 'success_url')).not.toThrow()
  expect(() => assertSameOriginUrl('https://app.example.com/return', 'success_url')).toThrow('does not match')
  config.payment.checkoutReturnOrigins = ['https://app.example.com']
  expect(() => assertSameOriginUrl('https://app.example.com/return?subscription=7', 'success_url')).not.toThrow()
  for (const url of ['https://app.example.com.evil.test/return', 'https://evil.test/return', 'http://app.example.com/return', 'https://name@app.example.com/return'])
    expect(() => assertSameOriginUrl(url, 'success_url')).toThrow()
})

test('trusted checkout origins reject paths, credentials and wildcards', () => {
  config.app.url = 'https://api.example.com'
  for (const origin of ['https://app.example.com/return', 'https://name@app.example.com', '*.example.com', 'https://app.example.com?return=evil']) {
    config.payment.checkoutReturnOrigins = [origin]
    expect(() => assertSameOriginUrl('https://app.example.com/return', 'success_url')).toThrow('bare HTTP origins')
  }
})
