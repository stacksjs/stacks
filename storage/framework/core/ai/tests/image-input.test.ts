import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { analyzeImage, resolveAllowedImagePath } from '../src/image'

let root: string
let allowed: string
let outside: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'stacks-ai-image-'))
  allowed = join(root, 'storage')
  outside = join(root, 'secrets')
  await mkdir(allowed, { recursive: true })
  await mkdir(outside, { recursive: true })
  await writeFile(join(allowed, 'cat.png'), 'png')
  await writeFile(join(outside, '.env'), 'APP_KEY=secret')
  await symlink(join(outside, '.env'), join(allowed, 'link.png'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('image file inputs stay inside the allowed directories', () => {
  it('reads a file inside an allowed root', async () => {
    expect(await resolveAllowedImagePath(join(allowed, 'cat.png'), [allowed])).toEndWith('cat.png')
  })

  it('refuses a path outside every root', async () => {
    await expect(resolveAllowedImagePath(join(outside, '.env'), [allowed])).rejects.toThrow('outside the allowed directories')
  })

  it('refuses traversal out of a root', async () => {
    await expect(resolveAllowedImagePath(join(allowed, '..', 'secrets', '.env'), [allowed])).rejects.toThrow('outside the allowed directories')
  })

  it('refuses a symlink inside a root that points outside it', async () => {
    await expect(resolveAllowedImagePath(join(allowed, 'link.png'), [allowed])).rejects.toThrow('outside the allowed directories')
  })
})

describe('image URL inputs are fetched as public URLs only', () => {
  const previous = process.env.ANTHROPIC_API_KEY
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })
  afterAll(() => {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = previous
  })

  it('refuses plain http by default', async () => {
    await expect(analyzeImage({ type: 'url', url: 'http://example.com/cat.png' }, 'describe')).rejects.toThrow('https://')
  })

  it('refuses loopback and cloud metadata addresses', async () => {
    await expect(analyzeImage({ type: 'url', url: 'https://127.0.0.1/cat.png' }, 'describe')).rejects.toThrow('private or local')
    await expect(analyzeImage({ type: 'url', url: 'https://169.254.169.254/latest/meta-data' }, 'describe')).rejects.toThrow('private or local')
  })
})
