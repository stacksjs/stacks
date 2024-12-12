import { toString } from '@stacksjs/strings'

export function getTypeName(v: any): string {
  if (v === null)
    return 'null'
  const type = toString(v).slice(8, -1).toLowerCase()

  return typeof v === 'object' || typeof v === 'function' ? type : typeof v
}
