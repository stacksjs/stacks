import { expect, test } from 'bun:test'
import { createModelGeometry, modelTransform, multiplyModelMatrices, parseBinaryModelStl, transformModelPoint } from '../src/model-viewer'
import type { ModelGeometry } from '../src/model-viewer'

test('indexed inline meshes preserve winding and repeated shared vertices without a fetch', () => {
  const geometry: ModelGeometry = { kind: 'mesh', vertices: [[0, 0, 0], [10, 0, 0], [10, 20, 0], [0, 20, 0]], triangles: [[0, 1, 2], [0, 2, 3]] }
  const output = createModelGeometry(geometry)
  expect([...output]).toEqual([0, 0, 0, 10, 0, 0, 10, 20, 0, 0, 0, 0, 10, 20, 0, 0, 20, 0])
  output[0] = 99
  expect(geometry.vertices[0]).toEqual([0, 0, 0])
})

test('inline meshes reject malformed, nonfinite, Float32-overflowing and oversized input before delivery', () => {
  const valid: Extract<ModelGeometry, { kind: 'mesh' }> = { kind: 'mesh', vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], triangles: [[0, 1, 2]] }
  const invalid = [
    { ...valid, vertices: [] }, { ...valid, triangles: [] },
    { ...valid, vertices: [[Number.NaN, 0, 0], [1, 0, 0], [0, 1, 0]] },
    { ...valid, vertices: [[1e100, 0, 0], [1, 0, 0], [0, 1, 0]] },
    { ...valid, vertices: [[0, 0], [1, 0, 0], [0, 1, 0]] },
    { ...valid, vertices: [[0, , 0], [1, 0, 0], [0, 1, 0]] },
    { ...valid, triangles: [[0, 1, 3]] }, { ...valid, triangles: [[0, -1, 2]] },
    { ...valid, triangles: [[0, 1.5, 2]] }, { ...valid, triangles: [[0, 0, 2]] },
    { ...valid, triangles: [[0, 1]] },
    { ...valid, triangles: [[0, , 2]] },
    { ...valid, vertices: Array.from({ length: 500001 }, () => [0, 0, 0]) },
    { ...valid, triangles: Array.from({ length: 500001 }, () => [0, 1, 2]) },
  ]
  for (const input of invalid)
    expect(() => createModelGeometry(input as typeof valid)).toThrow()
})

test('model transforms preserve CAD millimeters and compose local rotations before world placement', () => {
  const point = transformModelPoint([70, 155, 6], modelTransform([0, 27, 200], [90, 0, 0]))
  expect(point[0]).toBeCloseTo(70, 6)
  expect(point[1]).toBeCloseTo(21, 6)
  expect(point[2]).toBeCloseTo(355, 6)
  const joined = multiplyModelMatrices(modelTransform([0, 200, 200]), modelTransform([180, 0, 0], [0, -6, 0]))
  expect(transformModelPoint([0, 0, 0], joined)).toEqual([180, 200, 200])
})

test('native primitives have their authored extents and reject invalid holes and dimensions', () => {
  const box = createModelGeometry({ kind: 'box', size: [10, 20, 30] })
  expect(box.length).toBe(108)
  expect(Math.max(...box.filter((_, i) => i % 3 === 2))).toBe(15)
  const tube = createModelGeometry({ kind: 'tube', outer: 25, inner: 21, length: 680 })
  expect(Math.max(...tube.filter((_, i) => i % 3 === 2))).toBe(680)
  const ring = createModelGeometry({ kind: 'cylinder', radius: 200, innerRadius: 185, length: 50 })
  expect(Math.min(...ring.filter((_, i) => i % 3 === 2))).toBe(-25)
  expect(() => createModelGeometry({ kind: 'tube', outer: 20, inner: 22, length: 5 })).toThrow()
  expect(() => createModelGeometry({ kind: 'box', size: [1, Number.NaN, 2] })).toThrow()
  expect(() => createModelGeometry({ kind: 'cylinder', radius: 5, length: 2, segments: 1000000 })).toThrow()
})

test('binary STL loader uses vertex coordinates and refuses truncated, nonfinite or oversized meshes', () => {
  const data = new ArrayBuffer(134)
  const view = new DataView(data)
  view.setUint32(80, 1, true)
  const coordinates = [0, 0, 0, 10, 0, 0, 0, 20, 0]
  coordinates.forEach((value, i) => view.setFloat32(96 + i * 4, value, true))
  expect([...parseBinaryModelStl(data)]).toEqual(coordinates)
  expect(() => parseBinaryModelStl(data.slice(0, 120))).toThrow()
  view.setFloat32(96, Number.NaN, true)
  expect(() => parseBinaryModelStl(data)).toThrow('invalid coordinate')
  expect(() => parseBinaryModelStl(new ArrayBuffer(10))).toThrow()
})
