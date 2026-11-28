export function serializeEnvironmentValue(value: string): string {
  if (!value)
    return ''
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value))
    return value

  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')}"`
}
