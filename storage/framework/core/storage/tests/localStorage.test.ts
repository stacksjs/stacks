import { describe, expect, it } from 'bun:test'
import { Buffer } from 'node:buffer'
import { local } from '../src/drivers'

describe('@stacksjs/storage', () => {
  it('should read the file', async () => {
    const contents = await local.readToString('./dirs/sample.txt')

    expect(contents).toBe('test')
  })

  it('should read the file to Buffer', async () => {
    const contents = await local.readToBuffer('./dirs/sample.txt')

    expect(contents).toBeInstanceOf(Buffer)
    expect(contents.toString()).toBe('test')
  })

  it('should read the file to Uint8Array', async () => {
    const contents = await local.readToUint8Array('./dirs/sample.txt')

    expect(contents).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(contents)).toBe('test')
  })

  it('should generate a public URL', async () => {
    const path = './dirs/sample.txt'
    const url = await local.publicUrl(path, { baseUrl: 'localhost' })

    expect(url).toBe('localhost/dirs/sample.txt')
  })

  it('should get the mime type of a file', async () => {
    const mimeType = await local.mimeType('./dirs/sample.txt', { disallowFallback: false })
    expect(mimeType).toBe('text/plain')
  })

  it('should get the last modified time of a file', async () => {
    const lastModified = await local.lastModified('./dirs/sample.txt')
    expect(lastModified).toBeGreaterThan(0)
    expect(lastModified).toBeLessThanOrEqual(Date.now())
  })

  it('should get the file size', async () => {
    const size = await local.fileSize('./dirs/sample.txt')
    expect(size).toBe(4) // 'test' is 4 bytes
  })

  it('should throw an error when getting last modified time of non-existent file', async () => {
    await expect(local.lastModified('./non-existent.txt'))
      .rejects
      .toThrow('Unable to get last modified')
  })

  it('should throw an error when getting file size of non-existent file', async () => {
    await expect(local.fileSize('./non-existent.txt'))
      .rejects
      .toThrow('Unable to get file size')
  })

  it('should throw an error when getting mime type of non-existent file', async () => {
    const mimeType = await local.mimeType('./dirs/sample.txt', { disallowFallback: false })

    expect(mimeType).toBe('text/plain')
  })

  it('should list directory contents', async () => {
    const lists = await local.list('dirs')

    expect(lists).toBeDefined()

    const arrayList = await lists.toArray()

    expect(arrayList).toContainEqual(
      expect.objectContaining({ path: 'dirs/sample.txt' }),
    )
  })

  it('should change and get file visibility', async () => {
    await local.changeVisibility('./dirs/sample.txt', 'private')

    const visibility = await local.visibility('./dirs/sample.txt')

    expect(visibility).toBe('private')
  })

  it('should check if file exists', async () => {
    const exists = await local.fileExists('./dirs/sample.txt')
    expect(exists).toBe(true)

    const notExists = await local.fileExists('./non-existent.txt')
    expect(notExists).toBe(false)
  })

  it('should check if directory exists', async () => {
    const exists = await local.directoryExists('./dirs')
    expect(exists).toBe(true)

    const notExists = await local.directoryExists('./non-existent-dir')
    expect(notExists).toBe(false)
  })

  it('should get file stats', async () => {
    const stats = await local.stat('./dirs/sample.txt')

    expect(stats).toBeDefined()
    expect(stats.type).toBe('file')
  })

  it('should create a directory', async () => {
    const newDirPath = './new_test_dir'
    await local.createDirectory(newDirPath)
    const exists = await local.directoryExists(newDirPath)
    expect(exists).toBe(true)

    // Clean up
    await local.deleteFile(newDirPath)
  })

  it('should move a file', async () => {
    const sourcePath = './dirs/move.txt'
    const destinationPath = './copies/moved.txt'

    // Ensure the 'copies' directory exists
    await local.createDirectory('./dirs/copies')

    await local.moveFile(sourcePath, destinationPath)

    const sourceExists = await local.fileExists(sourcePath)
    const destinationExists = await local.fileExists(destinationPath)

    expect(sourceExists).toBe(false)
    expect(destinationExists).toBe(true)

    await Bun.$`touch ./dirs/move.txt`

    // Clean up
    await local.deleteFile(destinationPath)
    await local.deleteFile('./dirs/copies')
  })

  it('should copy a file', async () => {
    const sourcePath = './dirs/copy.txt'
    const destinationPath = './copies/copied.txt'

    // Ensure the 'copies' directory exists
    await local.createDirectory('./dirs/copies')

    await local.copyFile(sourcePath, destinationPath)

    const sourceExists = await local.fileExists(sourcePath)
    const destinationExists = await local.fileExists(destinationPath)

    expect(sourceExists).toBe(true)
    expect(destinationExists).toBe(true)

    // Clean up
    await local.deleteFile(destinationPath)
    await local.deleteFile('./dirs/copies')
  })

  it('should delete a file', async () => {
    const filePath = './dirs/delete.txt'

    // Ensure the file exists before deletion
    await local.write(filePath, 'This file will be deleted')

    const existsBeforeDeletion = await local.fileExists(filePath)
    expect(existsBeforeDeletion).toBe(true)

    await local.deleteFile(filePath)

    const existsAfterDeletion = await local.fileExists(filePath)
    expect(existsAfterDeletion).toBe(false)

    // Clean up: Restore the deleted file
    await Bun.$`touch ./dirs/delete.txt`
  })
})
