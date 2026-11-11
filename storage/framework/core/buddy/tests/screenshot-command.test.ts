// `buddy screenshot` photographs a page with Bun's own browser view. What it
// is asked for arrives as strings from a command line, so the parts that turn
// those strings into sizes, paths and a URL are pinned here; the view itself
// is Bun's.

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { boundedMs, pageUrl, parseViewports, screenshotPath, VIEWPORTS } from '../src/commands/screenshot'

describe('parseViewports', () => {
  test('defaults to a desktop', () => {
    expect(parseViewports(undefined)).toEqual([{ name: 'desktop', ...VIEWPORTS.desktop }])
    expect(parseViewports('')).toEqual([{ name: 'desktop', ...VIEWPORTS.desktop }])
  })

  test('takes names and sizes, in the order given, once each', () => {
    expect(parseViewports('mobile, Tablet,1280x720,mobile')).toEqual([
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 820, height: 1180 },
      { name: '1280x720', width: 1280, height: 720 },
    ])
  })

  test('refuses a name it does not know and a size no view can be', () => {
    expect(() => parseViewports('phone')).toThrow('Unknown viewport "phone"')
    expect(() => parseViewports('10x10')).toThrow('outside 200 to 7680')
    expect(() => parseViewports('99999x800')).toThrow('outside 200 to 7680')
    expect(() => parseViewports('1280')).toThrow('Unknown viewport')
  })
})

describe('screenshotPath', () => {
  const mobile = { name: 'mobile', ...VIEWPORTS.mobile! }

  test('one viewport writes the path as given', () => {
    expect(screenshotPath('shots/home.png', mobile, false)).toBe(resolve('shots/home.png'))
    expect(screenshotPath(undefined, mobile, false)).toBe(resolve('screenshot.png'))
  })

  test('several viewports each get their own file', () => {
    expect(screenshotPath('shots/home.png', mobile, true)).toBe(resolve('shots/home-mobile.png'))
    expect(screenshotPath('shots/home', { name: '1280x720', width: 1280, height: 720 }, true)).toBe(resolve('shots/home-1280x720.png'))
  })

  test('the picture is a PNG whatever extension was typed', () => {
    expect(screenshotPath('home.jpg', mobile, false)).toBe(resolve('home.png'))
    expect(screenshotPath('home.PNG', mobile, false)).toBe(resolve('home.PNG'))
  })
})

describe('pageUrl', () => {
  test('keeps http and https pages', () => {
    expect(pageUrl('https://example.com/pricing?plan=pro')).toBe('https://example.com/pricing?plan=pro')
    expect(pageUrl('http://localhost:3000')).toBe('http://localhost:3000/')
  })

  test('reads a bare host as an http page', () => {
    expect(pageUrl('localhost:3000/home')).toBe('http://localhost:3000/home')
    expect(pageUrl('127.0.0.1:8080')).toBe('http://127.0.0.1:8080/')
    expect(pageUrl('example.com/docs')).toBe('http://example.com/docs')
  })

  test('refuses anything that is not a page', () => {
    for (const value of ['file:///etc/passwd', 'javascript:alert(1)', 'tel:+15550100', 'prefs:root=General', '', 'not a url', '/just/a/path'])
      expect(pageUrl(value)).toBeNull()
  })
})

describe('boundedMs', () => {
  test('reads a number of milliseconds within bounds', () => {
    expect(boundedMs('2500', 1500)).toBe(2500)
    expect(boundedMs(0, 1500)).toBe(0)
    expect(boundedMs(9_999_999, 1500)).toBe(120_000)
  })

  test('falls back when it is not one', () => {
    expect(boundedMs('soon', 1500)).toBe(1500)
    expect(boundedMs(-5, 1500)).toBe(1500)
    expect(boundedMs(undefined, 1500)).toBe(1500)
  })
})
