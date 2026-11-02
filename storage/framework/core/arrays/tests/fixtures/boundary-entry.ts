import { at, last, sample } from '../../src/helpers'
import { average, median, min, max } from '../../src/math'
import { covariance, standardDeviation, zScore } from '../../src/math'
import { maxBy, sortBy, takeLast } from '../../src/transform'
import { setPath } from '../../../objects/src/transform'
import { addCalendarMonths, todayIn } from '../../../datetime/src/calendar'
import { isoInZone, zonedTimeToUtc, zoneOffsetMinutes } from '../../../datetime/src/zone'
const data = Array.from({ length: 250_000 }, (_, index) => index)
const results = { min: min(data), max: max(data), samples: sample([], 3), at: typeof at([] as string[], 99), last: typeof last([] as string[]), average: average([1e308, 1e308]), median: median([1e308, 1e308]) }
const pre = document.createElement('pre')
let calls = 0
sortBy([4, 3, 2, 1], value => { calls++; return value })
let invalid = false
try { zonedTimeToUtc('2026-02-30T12:00', 'UTC') }
catch (error) { invalid = error instanceof RangeError }
const zero = new Date('0000-06-01T12:00:00Z')
pre.textContent = JSON.stringify({ ...results, contracts: {
  largeDeviation: standardDeviation([1e200, -1e200]), tinyDeviation: standardDeviation([1e-200, -1e-200]),
  score: zScore([-1e308, 0], 1e308), covariance: covariance([1e200, 1e200, -1e200, -1e200], [1e200, -1e200, 1e200, -1e200]),
  mixedCovariance: covariance([1e16, -1e16, 1, -1], [1, -1, 1e16, -1e16]),
  cancelledCovariance: covariance([-3, -3, -4, -5, -1].map(value => value * 2 ** 665), [5, 4, 5, 0, 1].map(value => value * 2 ** 665)),
  selected: maxBy([{ id: 'low', value: -Infinity }], item => item.value)?.id,
  tail: takeLast([1, 2, 3], 1.5), calls, shortened: setPath([1, 2, 3], ['length'], 1), invalid,
  offset: zoneOffsetMinutes(zero, 'UTC'), day: todayIn('UTC', zero),
  leap: addCalendarMonths(new Date('0000-01-31T12:00:00Z'), 1, { utc: true }).toISOString(),
  expanded: isoInZone(new Date('+010000-01-01T00:00:37Z'), 'UTC'),
} })
document.body.append(pre)
