import type { ZlibCompressionOptions } from 'bun'
import archiver from 'archiver'
// import { handleError } from '@stacksjs/error-handling'

type ZipOptions = ZlibCompressionOptions & { output?: string }

export function archive(paths: string | string[], options?: ZipOptions) {
  return zip(paths, options)
}

export function unarchive(paths: string | string[]) {
  return unzip(paths)
}

export async function zip(paths: string | string[], options?: ZipOptions) {
  console.log('zip', paths, options)

  const output = fs.createWriteStream(options?.output || 'stx.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
  });

  archive.on('warning', function(err) {
    console.log('warning')
    if (err.code === 'ENOENT') {
      console.log(err)
    } else {
      console.log('error')
      // throw error
      throw err;
    }
  });

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
    console.log('error2')
    throw err;
  });

  // add the path files and directories from the paths array
  if (Array.isArray(paths)) {
    const globPattern = `{${paths.join(',')}}`;
    console.log('globPattern1', globPattern)
    archive.glob(globPattern, { ignore: ['node_modules'] });
  } else {
    console.log('globPattern2', paths)
    archive.glob(paths, { ignore: ['node_modules'] });
  }
}

export async function unzip(paths: string | string[]) {
  const data = []
  const pathsArray = Array.isArray(paths) ? paths : [paths]

  for (const path of pathsArray) {
    const file = Bun.file(path)
    const arrayBuffer = await file.arrayBuffer()
    data.push(new Uint8Array(arrayBuffer))
  }

  return gunzipSync(Buffer.concat(data)) // decompressed
}

export function compress(paths: string[], options?: ZipOptions) {
  return zip(paths, options) // compressed
}

export function decompress(paths: string | string[]) {
  return unzip(paths) // decompressed
}

export function gzipSync(buffer: Uint8Array, options?: ZipOptions) {
  return Bun.gzipSync(buffer, options) // buffer extends Uint8Array
}

export function gunzipSync(data: Uint8Array) {
  return Bun.gunzipSync(data) // decompressed
}

export async function deflateSync(data: Uint8Array, options?: ZipOptions) {
  return Bun.deflateSync(data, options) // compressed
}

export function inflateSync(data: Uint8Array) {
  return Bun.inflateSync(data) // decompressed
}
