import { describe, expect, it } from 'bun:test'
import { Buffer } from 'node:buffer'
import { rmSync } from 'node:fs'
import { local } from '../src/drivers'

const BASE = 'storage/framework/core/storage/tests'
const dirs = (file: string) => `${BASE}/dirs/${file}`

describe('@stacksjs/storage', () => {
  it('should read the file', async () => {
    const contents = await local.readToString(dirs('sample.txt'))

    expect(contents).toBe('test')
  })

  it('should read the file to Buffer', async () => {
    const contents = await local.readToBuffer(dirs('sample.txt'))

    expect(contents).toBeInstanceOf(Buffer)
    expect(contents.toString()).toBe('test')
  })

  it('should read the file to Uint8Array', async () => {
    const contents = await local.readToUint8Array(dirs('sample.txt'))

    expect(contents).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(contents)).toBe('test')
  })

  it('should generate a public URL', async () => {
    const filePath = dirs('sample.txt')
    const url = await local.publicUrl(filePath, { domain: 'https://localhost' })

    expect(url).toBe(`https://localhost/${filePath}`)
  })

  it('should get the mime type of a file', async () => {
    const mimeType = await local.mimeType(dirs('sample.txt'), { disallowFallback: false })
    expect(mimeType).toBe('text/plain')
  })

  it('should get the last modified time of a file', async () => {
    const lastModified = await local.lastModified(dirs('sample.txt'))
    expect(lastModified).toBeGreaterThan(0)
    expect(lastModified).toBeLessThanOrEqual(Date.now())
  })

  it('should get the file size', async () => {
    const size = await local.fileSize(dirs('sample.txt'))
    expect(size).toBe(4) // 'test' is 4 bytes
  })

  it('should throw an error when getting last modified time of non-existent file', async () => {
    await expect(local.lastModified(`${BASE}/non-existent.txt`))
      .rejects
      .toThrow()
  })

  it('should throw an error when getting file size of non-existent file', async () => {
    await expect(local.fileSize(`${BASE}/non-existent.txt`))
      .rejects
      .toThrow()
  })

  it('should throw an error when getting mime type of non-existent file', async () => {
    const mimeType = await local.mimeType(dirs('sample.txt'), { disallowFallback: false })

    expect(mimeType).toBe('text/plain')
  })

  it('should list directory contents', async () => {
    const gen = local.list(`${BASE}/dirs`)
    const items: any[] = []
    for await (const item of gen) {
      items.push(item)
    }

    expect(items.length).toBeGreaterThan(0)
    expect(items).toContainEqual(
      expect.objectContaining({ path: `${BASE}/dirs/sample.txt` }),
    )
  })

  it('should change and get file visibility', async () => {
    await local.changeVisibility(dirs('sample.txt'), 'private')

    const visibility = await local.visibility(dirs('sample.txt'))

    expect(visibility).toBe('private')
  })

  it('should check if file exists', async () => {
    const exists = await local.fileExists(dirs('sample.txt'))
    expect(exists).toBe(true)

    const notExists = await local.fileExists(`${BASE}/non-existent.txt`)
    expect(notExists).toBe(false)
  })

  it('should check if directory exists', async () => {
    const exists = await local.directoryExists(`${BASE}/dirs`)
    expect(exists).toBe(true)

    const notExists = await local.directoryExists(`${BASE}/non-existent-dir`)
    expect(notExists).toBe(false)
  })

  it('should get file stats', async () => {
    const stats = await local.stat(dirs('sample.txt'))

    expect(stats).toBeDefined()
    expect(stats.type).toBe('file')
  })

  it('should create a directory', async () => {
    const newDirPath = `${BASE}/new_test_dir`
    await local.createDirectory(newDirPath)
    const exists = await local.directoryExists(newDirPath)
    expect(exists).toBe(true)

    // Clean up
    rmSync(newDirPath, { recursive: true, force: true })
  })

  it('should move a file', async () => {
    const sourcePath = dirs('move.txt')
    const copiesDir = `${BASE}/dirs/copies`
    const destinationPath = `${BASE}/copies/moved.txt`

    // Ensure the 'copies' directory exists
    await local.createDirectory(copiesDir)

    await local.moveFile(sourcePath, destinationPath)

    const sourceExists = await local.fileExists(sourcePath)
    const destinationExists = await local.fileExists(destinationPath)

    expect(sourceExists).toBe(false)
    expect(destinationExists).toBe(true)

    // Restore moved file
    await local.moveFile(destinationPath, sourcePath)

    // Clean up
    rmSync(copiesDir, { recursive: true, force: true })
  })

  it('should copy a file', async () => {
    const sourcePath = dirs('copy.txt')
    const copiesDir = `${BASE}/dirs/copies`
    const destinationPath = `${BASE}/copies/copied.txt`

    // Ensure the 'copies' directory exists
    await local.createDirectory(copiesDir)

    await local.copyFile(sourcePath, destinationPath)

    const sourceExists = await local.fileExists(sourcePath)
    const destinationExists = await local.fileExists(destinationPath)

    expect(sourceExists).toBe(true)
    expect(destinationExists).toBe(true)

    // Clean up
    await local.deleteFile(destinationPath)
    rmSync(copiesDir, { recursive: true, force: true })
  })

  it('should delete a file', async () => {
    const filePath = dirs('delete.txt')

    // Ensure the file exists before deletion
    await local.write(filePath, 'This file will be deleted')

    const existsBeforeDeletion = await local.fileExists(filePath)
    expect(existsBeforeDeletion).toBe(true)

    await local.deleteFile(filePath)

    const existsAfterDeletion = await local.fileExists(filePath)
    expect(existsAfterDeletion).toBe(false)

    // Restore the deleted file
    await local.write(filePath, '')
  })
})
