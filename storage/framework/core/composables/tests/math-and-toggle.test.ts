import { describe, expect, it } from 'bun:test'

// Dynamic imports (preload handles @stacksjs/stx mock)
const { useAbs, useAverage, useCeil, useClamp, useFloor, useMax, useMin, usePrecision, useRound, useSum, useTrunc, logicNot, logicOr, or, and } = await import('../src/useMath')
const { useToggle } = await import('../src/useToggle')

// Local ref helper for creating test refs that match the MaybeRef shape
function ref<T>(initial: T) {
  let _value = initial
  const subscribers = new Set<(n: T, o: T) => void>()
  return {
    get value() { return _value },
    set value(v: T) { const old = _value; _value = v; for (const s of subscribers) s(v, old) },
    subscribe(fn: (n: T, o: T) => void) { subscribers.add(fn); return () => subscribers.delete(fn) },
  }
}

// ---------------------------------------------------------------------------
// useAbs
// ---------------------------------------------------------------------------
describe('useAbs', () => {
  it('should return the same value for a positive number', () => {
    const result = useAbs(5)
    expect(result.value).toBe(5)
  })

  it('should return the positive value for a negative number', () => {
    const result = useAbs(-7)
    expect(result.value).toBe(7)
  })

  it('should return zero for zero', () => {
    const result = useAbs(0)
    expect(result.value).toBe(0)
  })

  it('should return zero for negative zero', () => {
    const result = useAbs(-0)
    expect(result.value).toBe(0)
  })

  it('should return NaN for NaN input', () => {
    const result = useAbs(NaN)
    expect(Number.isNaN(result.value)).toBe(true)
  })

  it('should return Infinity for Infinity input', () => {
    const result = useAbs(Infinity)
    expect(result.value).toBe(Infinity)
  })

  it('should return Infinity for negative Infinity input', () => {
    const result = useAbs(-Infinity)
    expect(result.value).toBe(Infinity)
  })
})

// ---------------------------------------------------------------------------
// useAverage
// ---------------------------------------------------------------------------
describe('useAverage', () => {
  it('should compute the average of multiple numbers', () => {
    const result = useAverage(2, 4, 6)
    expect(result.value).toBe(4)
  })

  it('should return the number itself for a single argument', () => {
    const result = useAverage(10)
    expect(result.value).toBe(10)
  })

  it('should return 0 when called with no arguments', () => {
    const result = useAverage()
    expect(result.value).toBe(0)
  })

  it('should return NaN when any argument is NaN', () => {
    const result = useAverage(1, NaN, 3)
    expect(Number.isNaN(result.value)).toBe(true)
  })

  it('should handle negative numbers', () => {
    const result = useAverage(-10, 10)
    expect(result.value).toBe(0)
  })

  it('should handle decimal results', () => {
    const result = useAverage(1, 2)
    expect(result.value).toBe(1.5)
  })
})

// ---------------------------------------------------------------------------
// useCeil
// ---------------------------------------------------------------------------
describe('useCeil', () => {
  it('should round up positive decimals', () => {
    const result = useCeil(2.1)
    expect(result.value).toBe(3)
  })

  it('should round negative decimals toward zero', () => {
    const result = useCeil(-2.9)
    expect(result.value).toBe(-2)
  })

  it('should return the same value for an integer', () => {
    const result = useCeil(5)
    expect(result.value).toBe(5)
  })

  it('should return NaN for NaN input', () => {
    const result = useCeil(NaN)
    expect(Number.isNaN(result.value)).toBe(true)
  })

  it('should return Infinity for Infinity input', () => {
    const result = useCeil(Infinity)
    expect(result.value).toBe(Infinity)
  })

  it('should return zero for zero', () => {
    const result = useCeil(0)
    expect(result.value).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useClamp
// ---------------------------------------------------------------------------
describe('useClamp', () => {
  it('should return the value when it is within range', () => {
    const result = useClamp(5, 0, 10)
    expect(result.value).toBe(5)
  })

  it('should return min when value is below the range', () => {
    const result = useClamp(-5, 0, 10)
    expect(result.value).toBe(0)
  })

  it('should return max when value is above the range', () => {
    const result = useClamp(15, 0, 10)
    expect(result.value).toBe(10)
  })

  it('should return min when value equals min', () => {
    const result = useClamp(0, 0, 10)
    expect(result.value).toBe(0)
  })

  it('should return max when value equals max', () => {
    const result = useClamp(10, 0, 10)
    expect(result.value).toBe(10)
  })

  it('should handle an inverted range where min > max', () => {
    // Math.min(max, Math.max(min, value)) with min=10, max=0, value=5
    // Math.max(10, 5) = 10, Math.min(0, 10) = 0
    const result = useClamp(5, 10, 0)
    expect(result.value).toBe(0)
  })

  it('should handle a negative range', () => {
    const result = useClamp(-5, -10, -1)
    expect(result.value).toBe(-5)
  })

  it('should clamp to min when min equals max and value is below', () => {
    const result = useClamp(3, 5, 5)
    expect(result.value).toBe(5)
  })

  it('should clamp to max when min equals max and value is above', () => {
    const result = useClamp(7, 5, 5)
    expect(result.value).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// useFloor
// ---------------------------------------------------------------------------
describe('useFloor', () => {
  it('should round down positive decimals', () => {
    const result = useFloor(2.9)
    expect(result.value).toBe(2)
  })

  it('should round negative decimals away from zero', () => {
    const result = useFloor(-2.1)
    expect(result.value).toBe(-3)
  })

  it('should return the same value for an integer', () => {
    const result = useFloor(7)
    expect(result.value).toBe(7)
  })

  it('should return zero for zero', () => {
    const result = useFloor(0)
    expect(result.value).toBe(0)
  })

  it('should return NaN for NaN input', () => {
    const result = useFloor(NaN)
    expect(Number.isNaN(result.value)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// useMax
// ---------------------------------------------------------------------------
describe('useMax', () => {
  it('should return the maximum of multiple positive numbers', () => {
    const result = useMax(1, 5, 3, 9, 2)
    expect(result.value).toBe(9)
  })

  it('should handle mixed positive and negative numbers', () => {
    const result = useMax(-10, -1, 0, 5)
    expect(result.value).toBe(5)
  })

  it('should return the number itself for a single argument', () => {
    const result = useMax(42)
    expect(result.value).toBe(42)
  })

  it('should return -Infinity when called with no arguments', () => {
    const result = useMax()
    expect(result.value).toBe(-Infinity)
  })

  it('should return the shared value when all values are the same', () => {
    const result = useMax(5, 5, 5)
    expect(result.value).toBe(5)
  })

  it('should handle negative-only values', () => {
    const result = useMax(-100, -50, -1)
    expect(result.value).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// useMin
// ---------------------------------------------------------------------------
describe('useMin', () => {
  it('should return the minimum of multiple numbers', () => {
    const result = useMin(9, 3, 7, 1, 5)
    expect(result.value).toBe(1)
  })

  it('should handle mixed positive and negative numbers', () => {
    const result = useMin(-10, -1, 0, 5)
    expect(result.value).toBe(-10)
  })

  it('should return the number itself for a single argument', () => {
    const result = useMin(42)
    expect(result.value).toBe(42)
  })

  it('should return Infinity when called with no arguments', () => {
    const result = useMin()
    expect(result.value).toBe(Infinity)
  })

  it('should return the shared value when all values are the same', () => {
    const result = useMin(5, 5, 5)
    expect(result.value).toBe(5)
  })

  it('should handle positive-only values', () => {
    const result = useMin(100, 50, 1)
    expect(result.value).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// usePrecision
// ---------------------------------------------------------------------------
describe('usePrecision', () => {
  it('should round to 0 digits by default (integer)', () => {
    const result = usePrecision(3.14159)
    expect(result.value).toBe(3)
  })

  it('should round to 2 decimal places', () => {
    const result = usePrecision(3.14159, 2)
    expect(result.value).toBe(3.14)
  })

  it('should pad with zeros when more digits than actual precision', () => {
    const result = usePrecision(3.1, 5)
    expect(result.value).toBe(3.1)
  })

  it('should handle a large number', () => {
    const result = usePrecision(123456789.987654, 2)
    expect(result.value).toBe(123456789.99)
  })

  it('should return an integer when digits is 0', () => {
    const result = usePrecision(9.87, 0)
    expect(result.value).toBe(10)
  })

  it('should handle zero value', () => {
    const result = usePrecision(0, 3)
    expect(result.value).toBe(0)
  })

  it('should handle negative values', () => {
    const result = usePrecision(-3.14159, 2)
    expect(result.value).toBe(-3.14)
  })
})

// ---------------------------------------------------------------------------
// useRound
// ---------------------------------------------------------------------------
describe('useRound', () => {
  it('should round 2.4 down to 2', () => {
    const result = useRound(2.4)
    expect(result.value).toBe(2)
  })

  it('should round 2.5 up to 3', () => {
    const result = useRound(2.5)
    expect(result.value).toBe(3)
  })

  it('should round negative numbers correctly', () => {
    const result = useRound(-2.5)
    expect(result.value).toBe(-2)
  })

  it('should round -2.6 to -3', () => {
    const result = useRound(-2.6)
    expect(result.value).toBe(-3)
  })

  it('should return zero for zero', () => {
    const result = useRound(0)
    expect(result.value).toBe(0)
  })

  it('should return the same value for an integer', () => {
    const result = useRound(7)
    expect(result.value).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// useSum
// ---------------------------------------------------------------------------
describe('useSum', () => {
  it('should compute the sum of multiple numbers', () => {
    const result = useSum(1, 2, 3, 4)
    expect(result.value).toBe(10)
  })

  it('should return the number itself for a single argument', () => {
    const result = useSum(42)
    expect(result.value).toBe(42)
  })

  it('should return 0 when called with no arguments', () => {
    const result = useSum()
    expect(result.value).toBe(0)
  })

  it('should handle negative numbers', () => {
    const result = useSum(-5, 3, -2)
    expect(result.value).toBe(-4)
  })

  it('should handle large numbers of arguments', () => {
    const result = useSum(1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
    expect(result.value).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// useTrunc
// ---------------------------------------------------------------------------
describe('useTrunc', () => {
  it('should truncate a positive decimal toward zero', () => {
    const result = useTrunc(3.9)
    expect(result.value).toBe(3)
  })

  it('should truncate a negative decimal toward zero', () => {
    const result = useTrunc(-3.9)
    expect(result.value).toBe(-3)
  })

  it('should return the same value for an integer', () => {
    const result = useTrunc(5)
    expect(result.value).toBe(5)
  })

  it('should return NaN for NaN input', () => {
    const result = useTrunc(NaN)
    expect(Number.isNaN(result.value)).toBe(true)
  })

  it('should return zero for zero', () => {
    const result = useTrunc(0)
    expect(result.value).toBe(0)
  })

  it('should handle very small decimals', () => {
    const result = useTrunc(0.0001)
    expect(result.value).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// logicNot
// ---------------------------------------------------------------------------
describe('logicNot', () => {
  it('should return false for true input', () => {
    const result = logicNot(true)
    expect(result.value).toBe(false)
  })

  it('should return true for false input', () => {
    const result = logicNot(false)
    expect(result.value).toBe(true)
  })

  it('should return false for a truthy non-boolean value like 1', () => {
    const result = logicNot(1 as any)
    expect(result.value).toBe(false)
  })

  it('should return true for a falsy non-boolean value like 0', () => {
    const result = logicNot(0 as any)
    expect(result.value).toBe(true)
  })

  it('should return true for a falsy empty string', () => {
    const result = logicNot('' as any)
    expect(result.value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// logicOr / or
// ---------------------------------------------------------------------------
describe('logicOr', () => {
  it('should return false when all arguments are false', () => {
    const result = logicOr(false, false, false)
    expect(result.value).toBe(false)
  })

  it('should return true when some arguments are true', () => {
    const result = logicOr(false, true, false)
    expect(result.value).toBe(true)
  })

  it('should return true when all arguments are true', () => {
    const result = logicOr(true, true, true)
    expect(result.value).toBe(true)
  })

  it('should return false when called with no arguments', () => {
    const result = logicOr()
    expect(result.value).toBe(false)
  })

  it('should handle a single true argument', () => {
    const result = logicOr(true)
    expect(result.value).toBe(true)
  })

  it('should handle a single false argument', () => {
    const result = logicOr(false)
    expect(result.value).toBe(false)
  })
})

describe('or (alias for logicOr)', () => {
  it('should be the same function as logicOr', () => {
    expect(or).toBe(logicOr)
  })

  it('should behave identically to logicOr', () => {
    const result = or(false, true, false)
    expect(result.value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// and
// ---------------------------------------------------------------------------
describe('and', () => {
  it('should return true when all arguments are true', () => {
    const result = and(true, true, true)
    expect(result.value).toBe(true)
  })

  it('should return false when some arguments are false', () => {
    const result = and(true, false, true)
    expect(result.value).toBe(false)
  })

  it('should return false when all arguments are false', () => {
    const result = and(false, false, false)
    expect(result.value).toBe(false)
  })

  it('should return true when called with no arguments', () => {
    // Array.every on empty array returns true
    const result = and()
    expect(result.value).toBe(true)
  })

  it('should handle a single true argument', () => {
    const result = and(true)
    expect(result.value).toBe(true)
  })

  it('should handle a single false argument', () => {
    const result = and(false)
    expect(result.value).toBe(false)
  })

})

// ---------------------------------------------------------------------------
// useToggle
// ---------------------------------------------------------------------------
describe('useToggle', () => {
  it('should default to false', () => {
    const [state] = useToggle()
    expect(state.value).toBe(false)
  })

  it('should toggle from false to true and back', () => {
    const [state, toggle] = useToggle()
    expect(state.value).toBe(false)
    toggle()
    expect(state.value).toBe(true)
    toggle()
    expect(state.value).toBe(false)
  })

  it('should set a specific value with toggle(true)', () => {
    const [state, toggle] = useToggle()
    toggle(true)
    expect(state.value).toBe(true)
    toggle(true)
    expect(state.value).toBe(true)
  })

  it('should set a specific value with toggle(false)', () => {
    const [state, toggle] = useToggle(true)
    toggle(false)
    expect(state.value).toBe(false)
    toggle(false)
    expect(state.value).toBe(false)
  })

  it('should accept an initial value of true', () => {
    const [state] = useToggle(true)
    expect(state.value).toBe(true)
  })

  it('should accept a ref as the initial value', () => {
    const r = ref(true)
    const [state, toggle] = useToggle(r)
    expect(state.value).toBe(true)
    toggle()
    expect(state.value).toBe(false)
    // The returned state should be the same ref
    expect(state).toBe(r)
    expect(r.value).toBe(false)
  })

  it('should return the new state value from toggle()', () => {
    const [, toggle] = useToggle()
    const first = toggle()
    expect(first).toBe(true)
    const second = toggle()
    expect(second).toBe(false)
    const third = toggle(true)
    expect(third).toBe(true)
    const fourth = toggle(false)
    expect(fourth).toBe(false)
  })

  it('should flip when toggle(undefined) is called since undefined is not a boolean', () => {
    const [state, toggle] = useToggle()
    expect(state.value).toBe(false)
    toggle(undefined)
    expect(state.value).toBe(true)
    toggle(undefined)
    expect(state.value).toBe(false)
  })

  it('should handle multiple rapid toggles correctly', () => {
    const [state, toggle] = useToggle(false)
    for (let i = 0; i < 100; i++) {
      toggle()
    }
    // 100 toggles from false: even number means back to false
    expect(state.value).toBe(false)
  })

  it('should handle odd number of rapid toggles', () => {
    const [state, toggle] = useToggle(false)
    for (let i = 0; i < 99; i++) {
      toggle()
    }
    // 99 toggles from false: odd number means true
    expect(state.value).toBe(true)
  })

  it('should allow setting explicit values interleaved with toggles', () => {
    const [state, toggle] = useToggle()
    toggle()       // true
    toggle(false)  // false
    toggle()       // true
    toggle(true)   // true (explicit)
    toggle()       // false
    expect(state.value).toBe(false)
  })
})
