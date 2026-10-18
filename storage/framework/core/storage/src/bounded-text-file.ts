import { constants as bufferConstants } from 'node:buffer'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'

export interface BoundedTextFileOptions {
  /** Maximum encoded byte length, including a UTF-8 BOM when present. */
  maxBytes: number
}

export type BoundedTextFileErrorCode = 'NOT_REGULAR_FILE' | 'FILE_TOO_LARGE' | 'INVALID_UTF8' | 'UNSUPPORTED_PLATFORM'

export class BoundedTextFileError extends Error {
  readonly code: BoundedTextFileErrorCode

  constructor(code: BoundedTextFileErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'BoundedTextFileError'
    this.code = code
  }
}

/**
 * Read a local regular file as strict UTF-8, consuming at most maxBytes + 1.
 * Reject final-component symlinks and open special files without waiting for
 * a FIFO writer. Parent directories are followed: callers own path authorization.
 * This is a bounded read of a changing file, not an atomic content snapshot.
 * Native open/stat/read/close errors propagate unchanged; the descriptor closes
 * on every path after a successful open. Unsupported safety flags fail closed.
 */
export async function readBoundedTextFile(path: string, options: BoundedTextFileOptions): Promise<string> {
  const { maxBytes } = options
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes >= bufferConstants.MAX_LENGTH)
    throw new RangeError(`maxBytes must be an integer between 0 and ${bufferConstants.MAX_LENGTH - 1}`)

  if (!constants.O_NOFOLLOW || !constants.O_NONBLOCK)
    throw new BoundedTextFileError('UNSUPPORTED_PLATFORM', 'Bounded text reads require O_NOFOLLOW and O_NONBLOCK support')

  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await file.stat()
    if (!stat.isFile())
      throw new BoundedTextFileError('NOT_REGULAR_FILE', 'Text input must be a regular file')
    if (stat.size > maxBytes)
      throw new BoundedTextFileError('FILE_TOO_LARGE', `Text file exceeds ${maxBytes} bytes`)

    // The extra byte detects growth after fstat without an unbounded readFile.
    const bytes = new Uint8Array(maxBytes + 1)
    let length = 0
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length, null)
      if (bytesRead === 0)
        break
      length += bytesRead
    }
    if (length > maxBytes)
      throw new BoundedTextFileError('FILE_TOO_LARGE', `Text file exceeds ${maxBytes} bytes`)

    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))
    }
    catch (cause) {
      throw new BoundedTextFileError('INVALID_UTF8', 'Text file must contain valid UTF-8', { cause })
    }
  }
  finally {
    await file.close()
  }
}
