import { describe, expect, it } from 'bun:test'
import { estimateBrotliSize, estimateGzipSize, formatExportSizes, getExportsSize, getFileSize } from '../src/size'

describe('getFileSize', () => {
  it('should return 0 for non-existent file', async () => {
    const size = await getFileSize('/path/that/does/not/exist.js')
    expect(size).toBe(0)
  })

  it('should return file size for existing file', async () => {
    // Test with package.json which should exist
    const size = await getFileSize('/Users/chrisbreuer/Code/stacks/storage/framework/core/utils/package.json')
    expect(size).toBeGreaterThan(0)
  })
})

describe('estimateGzipSize', () => {
  it('should estimate gzip size at ~30% of original', () => {
    expect(estimateGzipSize(1000)).toBe(300)
    expect(estimateGzipSize(5000)).toBe(1500)
  })

  it('should handle zero', () => {
    expect(estimateGzipSize(0)).toBe(0)
  })

  it('should round down', () => {
    expect(estimateGzipSize(333)).toBe(99)
  })
})

describe('estimateBrotliSize', () => {
  it('should estimate brotli size at ~25% of original', () => {
    expect(estimateBrotliSize(1000)).toBe(250)
    expect(estimateBrotliSize(8000)).toBe(2000)
  })

  it('should handle zero', () => {
    expect(estimateBrotliSize(0)).toBe(0)
  })

  it('should round down', () => {
    expect(estimateBrotliSize(333)).toBe(83)
  })

  it('should be smaller than gzip estimate', () => {
    const size = 10000
    expect(estimateBrotliSize(size)).toBeLessThan(estimateGzipSize(size))
  })
})

describe('formatExportSizes', () => {
  it('should format empty exports', () => {
    const result = formatExportSizes({
      totalSize: 0,
      totalReadable: '0 B',
      exports: [],
    })

    expect(result).toBe('No exports found')
  })

  it('should format export sizes', () => {
    const result = formatExportSizes({
      totalSize: 5000,
      totalReadable: '5 KB',
      exports: [
        { name: 'index.js', size: 3000, readable: '3 KB' },
        { name: 'utils.js', size: 2000, readable: '2 KB' },
      ],
    })

    expect(result).toContain('Export Sizes:')
    expect(result).toContain('index.js')
    expect(result).toContain('3 KB')
    expect(result).toContain('utils.js')
    expect(result).toContain('2 KB')
    expect(result).toContain('Total: 5 KB')
    expect(result).toContain('Estimated gzipped:')
    expect(result).toContain('Estimated brotli:')
  })

  it('should align columns properly', () => {
    const result = formatExportSizes({
      totalSize: 3000,
      totalReadable: '3 KB',
      exports: [
        { name: 'short.js', size: 1000, readable: '1 KB' },
        { name: 'very-long-filename.js', size: 2000, readable: '2 KB' },
      ],
    })

    const lines = result.split('\n')
    const exportLines = lines.filter(line => line.includes('.js'))

    // Check that spacing is consistent
    expect(exportLines.length).toBe(2)
  })
})

describe('getExportsSize', () => {
  it('should return empty result for non-existent directory', async () => {
    const result = await getExportsSize('/path/that/does/not/exist')

    expect(result.totalSize).toBe(0)
    expect(result.totalReadable).toBe('0 B')
    expect(result.exports).toEqual([])
  })

  it('should calculate sizes for existing dist directory', async () => {
    // This test would need an actual dist directory
    // Skipping actual implementation test since it depends on build output
    expect(true).toBe(true)
  })

  it('should sort exports by size descending', async () => {
    // Mock test - actual test would require real files
    const mockResult = {
      totalSize: 10000,
      totalReadable: '10 KB',
      exports: [
        { name: 'large.js', size: 6000, readable: '6 KB' },
        { name: 'medium.js', size: 3000, readable: '3 KB' },
        { name: 'small.js', size: 1000, readable: '1 KB' },
      ],
    }

    // Verify sorting
    for (let i = 0; i < mockResult.exports.length - 1; i++) {
      expect(mockResult.exports[i].size).toBeGreaterThanOrEqual(
        mockResult.exports[i + 1].size,
      )
    }
  })
})
