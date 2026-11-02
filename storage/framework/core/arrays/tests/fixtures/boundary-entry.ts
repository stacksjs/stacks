import { at, last, sample } from '../../src/helpers'
import { average, median, min, max } from '../../src/math'
const data = Array.from({ length: 250_000 }, (_, index) => index)
const results = { min: min(data), max: max(data), samples: sample([], 3), at: typeof at([] as string[], 99), last: typeof last([] as string[]), average: average([1e308, 1e308]), median: median([1e308, 1e308]) }
const pre = document.createElement('pre')
pre.textContent = JSON.stringify(results)
document.body.append(pre)
