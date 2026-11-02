/** Reserved object machinery cannot be a submission's machine key. */
export function isReservedFieldName(name: string): boolean {
  return name === '__proto__' || name === 'constructor' || name === 'prototype'
}
