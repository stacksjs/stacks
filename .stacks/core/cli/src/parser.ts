// Thanks to mri for their great library!
// https://github.com/lukeed/mri
// TODO: ensure type-safety throughout this file

function toArr(any: any): any[] {
  return any == null ? [] : Array.isArray(any) ? any : [any]
}

function toVal(out: any, key: any, val: any, opts: any) {
  let x
  const old = out[key]
  const nxt = (
    ~opts.string.indexOf(key)
      ? (val == null || val === true ? '' : String(val))
      : typeof val === 'boolean'
        ? val
        : ~opts.boolean.indexOf(key)
          // eslint-disable-next-line no-cond-assign
            ? (val === 'false' ? false : val === 'true' || (out._.push((x = +val, x * 0 === 0) ? x : val), !!val))
          // eslint-disable-next-line no-cond-assign
            : (x = +val, x * 0 === 0) ? x : val
  )
  out[key] = old == null ? nxt : (Array.isArray(old) ? old.concat(nxt) : [old, nxt])
}

export function parser(args: any, opts?: any) {
  args = args || []
  opts = opts || {}

  let k
  let arr
  let arg: any
  let name
  let val
  let i = 0
  let j = 0
  let idx = 0

  const out = { _: [] }
  const len = args.length
  // eslint-disable-next-line no-void
  const alibi = opts.alias !== void 0
  // eslint-disable-next-line no-void
  const strict = opts.unknown !== void 0
  // eslint-disable-next-line no-void
  const defaults = opts.default !== void 0

  opts.alias = opts.alias || {}
  opts.string = toArr(opts.string)
  opts.boolean = toArr(opts.boolean)

  if (alibi) {
    for (k in opts.alias) {
      arr = opts.alias[k] = toArr(opts.alias[k])
      for (i = 0; i < arr.length; i++)
        (opts.alias[arr[i]] = arr.concat(k)).splice(i, 1)
    }
  }

  for (i = opts.boolean.length; i-- > 0;) {
    arr = opts.alias[opts.boolean[i]] || []
    for (j = arr.length; j-- > 0;) opts.boolean.push(arr[j])
  }

  for (i = opts.string.length; i-- > 0;) {
    arr = opts.alias[opts.string[i]] || []
    for (j = arr.length; j-- > 0;) opts.string.push(arr[j])
  }

  if (defaults) {
    for (k in opts.default) {
      name = typeof opts.default[k]
      arr = opts.alias[k] = opts.alias[k] || []

      // eslint-disable-next-line no-void
      if (opts[name] !== void 0) {
        opts[name].push(k)
        for (i = 0; i < arr.length; i++)
          opts[name].push(arr[i])
      }
    }
  }

  const keys = strict ? Object.keys(opts.alias) : []

  for (i = 0; i < len; i++) {
    arg = args[i]

    if (arg === '--') {
      out._ = out._.concat(args.slice(++i))
      break
    }

    for (j = 0; j < arg.length; j++) {
      if (arg.charCodeAt(j) !== 45)
        break
    } // "-"

    if (j === 0) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      out._.push(arg)
    }
    else if (arg.substring(j, j + 3) === 'no-') {
      name = arg.substring(j + 3)
      if (strict && !~keys.indexOf(name))
        return opts.unknown(arg)

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      out[name] = false
    }
    else {
      for (idx = j + 1; idx < arg.length; idx++) {
        if (arg.charCodeAt(idx) === 61)
          break
      } // "="

      name = arg.substring(j, idx)
      val = arg.substring(++idx) || (i + 1 === len || (`${args[i + 1]}`).charCodeAt(0) === 45 || args[++i])
      arr = (j === 2 ? [name] : name)

      for (idx = 0; idx < arr.length; idx++) {
        name = arr[idx]
        if (strict && !~keys.indexOf(name))
          return opts.unknown('-'.repeat(j) + name)
        toVal(out, name, (idx + 1 < arr.length) || val, opts)
      }
    }
  }

  if (defaults) {
    for (k in opts.default) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line no-void
      if (out[k] === void 0) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        out[k] = opts.default[k]
      }
    }
  }

  if (alibi) {
    for (k in out) {
      arr = opts.alias[k] || []
      while (arr.length > 0) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        out[arr.shift()] = out[k]
      }
    }
  }

  return out
}
