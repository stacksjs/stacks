const POOL_SIZE_MULTIPLIER = 128
let pool: Uint8Array | null = null
let poolOffset = 0

const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

function fillPool(bytes: number) {
  if (!pool || pool.length < bytes) {
    pool = new Uint8Array(bytes * POOL_SIZE_MULTIPLIER)
    globalThis.crypto.getRandomValues(pool)
    poolOffset = 0
  }
  else if (poolOffset + bytes > pool.length) {
    globalThis.crypto.getRandomValues(pool)
    poolOffset = 0
  }
  poolOffset += bytes
}

function randomPool(bytes: number): Uint8Array {
  fillPool((bytes |= 0))

  if (!pool) {
    throw new Error('Pool is not initialized')
  }

  return pool.subarray(poolOffset - bytes, poolOffset)
}

function customRandom(alphabet: string, defaultSize: number, getRandom: (bytes: number) => Uint8Array) {
  const mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1

  const step = Math.ceil((1.6 * mask * defaultSize) / alphabet.length)

  return (size: number = defaultSize): string => {
    let id = ''
    while (true) {
      const bytes = getRandom(step)
      let i = step

      while (i--) {
        id += alphabet[bytes[i] & mask] || ''
        if (id.length >= size)
          return id
      }
    }
  }
}

function customAlphabet(alphabet: string, size: number = 21): (size?: number) => string {
  return customRandom(alphabet, size, randomPool)
}

function randomNonSecure(size = 21): string {
  let id = ''

  let i = size | 0
  while (i--) {
    id += urlAlphabet[(Math.random() * 64) | 0]
  }
  return id
}

function random(size: number = 21): string {
  fillPool((size |= 0))

  if (!pool) {
    return ''
  }

  let id = ''

  // We are reading directly from the random pool to avoid creating new array
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63]
  }
  return id
}

export {
  customAlphabet,
  customRandom,
  random,
  randomNonSecure,
}
