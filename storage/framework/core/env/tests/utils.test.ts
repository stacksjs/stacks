import { describe, expect, test } from 'bun:test'
import {
  hasTTY,
  hasWindow,
  isBun,
  isCI,
  isColorSupported,
  isDebug,
  isLinux,
  isMacOS,
  isMinimal,
  isNode,
  isWindows,
  platform,
  provider,
  providerInfo,
  runtime,
  runtimeInfo,
} from '../src/utils'

describe('Runtime Detection', () => {
  test('should detect Bun runtime', () => {
    expect(isBun).toBe(true)
    expect(isNode).toBe(true) // Bun also has process
  })

  test('should identify runtime correctly', () => {
    expect(runtime).toBe('bun')
    expect(runtimeInfo.name).toBe('bun')
    expect(runtimeInfo.version).toBeDefined()
    expect(typeof runtimeInfo.version).toBe('string')
  })
})

describe('Platform Detection', () => {
  test('should detect platform', () => {
    expect(platform).toBeDefined()
    expect(['darwin', 'linux', 'win32', 'freebsd', 'openbsd', 'sunos', 'aix']).toContain(platform)
  })

  test('should detect OS type', () => {
    // At least one should be true
    const osDetected = isWindows || isMacOS || isLinux
    expect(osDetected).toBe(true)

    // Only one should be true (mutually exclusive)
    const trueCount = [isWindows, isMacOS, isLinux].filter(Boolean).length
    expect(trueCount).toBe(1)
  })

  test('should match platform with OS booleans', () => {
    if (platform === 'win32') {
      expect(isWindows).toBe(true)
      expect(isMacOS).toBe(false)
      expect(isLinux).toBe(false)
    }
    else if (platform === 'darwin') {
      expect(isWindows).toBe(false)
      expect(isMacOS).toBe(true)
      expect(isLinux).toBe(false)
    }
    else if (platform === 'linux') {
      expect(isWindows).toBe(false)
      expect(isMacOS).toBe(false)
      expect(isLinux).toBe(true)
    }
  })
})

describe('Environment Detection', () => {
  test('should detect TTY', () => {
    expect(typeof hasTTY).toBe('boolean')
  })

  test('should detect window (browser)', () => {
    expect(hasWindow).toBe(false) // Should be false in Node/Bun environment
  })

  test('should detect CI environment', () => {
    expect(typeof isCI).toBe('boolean')
    // CI detection based on environment variables
  })

  test('should detect debug mode', () => {
    expect(typeof isDebug).toBe('boolean')
  })

  test('should detect minimal mode', () => {
    expect(typeof isMinimal).toBe('boolean')
    // Minimal mode should be true in CI or when no TTY
    if (isCI || !hasTTY) {
      expect(isMinimal).toBe(true)
    }
  })

  test('should detect color support', () => {
    expect(typeof isColorSupported).toBe('boolean')
    // Color should not be supported in minimal environments
    if (isMinimal) {
      expect(isColorSupported).toBe(false)
    }
  })
})

describe('Provider Detection', () => {
  test('should identify provider', () => {
    expect(typeof provider).toBe('string')
    expect(provider).toBeDefined()
  })

  test('should have valid provider info', () => {
    expect(providerInfo).toBeDefined()
    expect(typeof providerInfo.name).toBe('string')
    expect(typeof providerInfo.detected).toBe('boolean')
  })

  test('should detect known providers or unknown', () => {
    const knownProviders = [
      'github',
      'gitlab',
      'circle',
      'travis',
      'jenkins',
      'vercel',
      'netlify',
      'heroku',
      'aws',
      'azure',
      'cloudflare',
      'railway',
      'render',
      'unknown',
    ]
    expect(knownProviders).toContain(provider)
  })

  test('provider info should match provider detection', () => {
    if (provider !== 'unknown') {
      expect(providerInfo.detected).toBe(true)
    }
  })
})

describe('Type Safety', () => {
  test('should have correct types', () => {
    // Boolean types
    expect(typeof isBun).toBe('boolean')
    expect(typeof isNode).toBe('boolean')
    expect(typeof isWindows).toBe('boolean')
    expect(typeof isMacOS).toBe('boolean')
    expect(typeof isLinux).toBe('boolean')
    expect(typeof hasTTY).toBe('boolean')
    expect(typeof hasWindow).toBe('boolean')
    expect(typeof isCI).toBe('boolean')
    expect(typeof isDebug).toBe('boolean')
    expect(typeof isMinimal).toBe('boolean')
    expect(typeof isColorSupported).toBe('boolean')

    // String types
    expect(typeof runtime).toBe('string')
    expect(typeof platform).toBe('string')
    expect(typeof provider).toBe('string')

    // Object types
    expect(typeof runtimeInfo).toBe('object')
    expect(typeof providerInfo).toBe('object')
  })

  test('runtime should be one of known values', () => {
    expect(['bun', 'node', 'unknown']).toContain(runtime)
  })
})
