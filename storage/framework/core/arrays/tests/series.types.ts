// Compile after building with standalone tsc: resolves the public package export and its published declarations.
import { summarizeSeries } from '@stacksjs/arrays'
const summary = summarizeSeries([{ date: '2026-01-01', value: 0 }])
const count: number = summary.count
const latest: number | undefined = summary.latest?.value
const average: number | null = summary.average
void [count, latest, average]
