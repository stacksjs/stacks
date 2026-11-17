import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createImageData, encode } from 'ts-images'
import { generateAppStoreScreenshotSet } from '../src/app-store'

test('the configured Stacks generator produces store-ready RGB screenshots', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'stacks-store-rgb-'))
  try {
    const capture = createImageData(16, 32, { fill: { r: 24, g: 28, b: 32, a: 255 } })
    await writeFile(resolve(root, 'capture.png'), await encode(capture, 'png'))
    const font = resolve(import.meta.dir, 'font-fixtures/Anton-Regular.ttf')
    const result = await generateAppStoreScreenshotSet({
      fonts: { title: font, body: font },
      appStore: { enabled: true, outputDir: 'store', displays: ['APP_IPHONE_67'], slides: [{ capture: 'capture.png', headline: 'YOUR TRAINING' }] },
    }, root)
    const bytes = await readFile(result.APP_IPHONE_67![0]!)
    expect(bytes.readUInt32BE(16)).toBe(1290)
    expect(bytes.readUInt32BE(20)).toBe(2796)
    expect(bytes[25]).toBe(2)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
