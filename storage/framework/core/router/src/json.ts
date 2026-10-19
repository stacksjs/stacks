export interface JsonParseOptions {
  /** Refuse ambiguous object members, including escaped spellings of the same key. */
  rejectDuplicateKeys?: boolean
}

/** Parse already-decoded JSON. Callers reading a wire body must enforce its byte/UTF-8 limits first. */
export function parseJsonText(text: string, options: JsonParseOptions = {}): unknown {
  if (typeof text !== 'string') throw new TypeError('JSON text must be a string')
  const result: unknown = JSON.parse(text)
  if (!options.rejectDuplicateKeys)
    return result

  // JSON.parse has validated the grammar. Only object-key identity remains to
  // check; an iterative scan avoids recursing through attacker-controlled depth.
  const containers: Array<Set<string> | null> = []
  for (let position = 0; position < text.length; position++) {
    const character = text[position]
    if (character === '{') containers.push(new Set())
    else if (character === '[') containers.push(null)
    else if (character === '}' || character === ']') containers.pop()
    else if (character === '"') {
      const start = position
      while (++position < text.length) {
        if (text[position] === '\\') position++
        else if (text[position] === '"') break
      }
      let next = position + 1
      while (next < text.length && /\s/.test(text[next]!)) next++
      if (text[next] !== ':') continue
      const keys = containers.at(-1)
      if (!keys) throw new SyntaxError('Invalid JSON object key')
      const key = JSON.parse(text.slice(start, position + 1)) as string
      if (keys.has(key)) throw new SyntaxError('Duplicate JSON object key')
      keys.add(key)
    }
  }
  return result
}
