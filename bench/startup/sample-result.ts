export interface ProcessSampleResult {
  importMs: number
  rssBytes: number
}

export function parseProcessSample(stdout: string, stderr: string): ProcessSampleResult {
  if (stderr.trim())
    throw new Error(`Startup sample wrote to stderr: ${stderr.trim()}`)
  const trimmed = stdout.trim()
  if (!trimmed)
    throw new Error('Startup sample produced no output')

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  }
  catch {
    throw new Error(`Startup sample produced malformed JSON: ${trimmed}`)
  }
  if (!parsed || typeof parsed !== 'object')
    throw new Error('Startup sample result must be an object')

  const candidate = parsed as Partial<ProcessSampleResult>
  if (!Number.isFinite(candidate.importMs) || candidate.importMs! <= 0)
    throw new Error('Startup sample returned an invalid import time')
  if (!Number.isSafeInteger(candidate.rssBytes) || candidate.rssBytes! <= 0)
    throw new Error('Startup sample returned an invalid RSS value')
  return { importMs: candidate.importMs!, rssBytes: candidate.rssBytes! }
}
