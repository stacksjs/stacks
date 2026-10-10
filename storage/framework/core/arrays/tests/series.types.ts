// Compile after building: checks the published declaration rather than source inference.
import { summarizeSeries } from '../dist/series'
const summary = summarizeSeries([{ date: '2026-01-01', value: 0 }])
const count: number = summary.count
const latest: number | undefined = summary.latest?.value
const average: number | null = summary.average
void [count, latest, average]
