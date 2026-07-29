export interface ReleaseRecord {
  id: number | string
  version: string
  type: string
  status: string
  notes: string
  downloads: number
  author: string
  createdAt: string
}

export interface ReleaseSummary {
  total: number
  published: number
  downloads: number
  latestVersion: string | null
}

function value(record: any, key: string): unknown {
  if (record && typeof record.get === 'function')
    return record.get(key)
  return record?.[key]
}

function text(input: unknown, fallback = ''): string {
  if (input === null || input === undefined)
    return fallback
  return String(input)
}

function count(input: unknown): number {
  const parsed = Number(input)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function normalizeReleaseRecord(record: any): ReleaseRecord {
  return {
    id: text(value(record, 'id') ?? value(record, 'uuid')),
    version: text(value(record, 'version'), 'Unversioned'),
    type: text(value(record, 'type'), 'unknown'),
    status: text(value(record, 'status'), 'unknown'),
    notes: text(value(record, 'notes')),
    downloads: count(value(record, 'downloads')),
    author: text(value(record, 'author')),
    createdAt: text(value(record, 'created_at') ?? value(record, 'createdAt')),
  }
}

export function summarizeReleases(releases: ReleaseRecord[]): ReleaseSummary {
  return {
    total: releases.length,
    published: releases.filter(release => release.status.toLowerCase() === 'published').length,
    downloads: releases.reduce((total, release) => total + release.downloads, 0),
    latestVersion: releases[0]?.version ?? null,
  }
}
