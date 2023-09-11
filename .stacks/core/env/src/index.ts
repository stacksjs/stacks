const handler = {
  get: (target: typeof Bun.env, key: string) => {
    // @ts-ignore
    const value = target[key]
    if (value === 'true') return true
    if (value === 'false') return false
    if (!isNaN(Number(value))) return Number(value)
    return value
  }
}

export const env = new Proxy(Bun.env, handler)
