/** Weakly retain successful projections so array element tests need not validate twice. */
const key = Symbol.for('stacks.validation.projectedValues')
const values = ((globalThis as Record<symbol, unknown>)[key] ??= new WeakMap<object, WeakMap<object, unknown>>()) as WeakMap<object, WeakMap<object, unknown>>
export function rememberValidatedValue(rule: object, input: unknown, value: unknown): void {
  if (!input || typeof input !== 'object') return
  let entries = values.get(rule)
  if (!entries) values.set(rule, entries = new WeakMap())
  entries.set(input, value)
}
export function validatedValue(rule: object, input: unknown): unknown {
  if (!input || typeof input !== 'object') return input
  const entries = values.get(rule)
  return entries?.has(input) ? entries.get(input) : input
}
