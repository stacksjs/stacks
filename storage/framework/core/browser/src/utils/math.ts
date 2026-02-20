export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

export function rand(min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Re-export reactive math utilities from @stacksjs/composables
export {
  and,
  logicNot,
  logicOr,
  or,
  useAbs,
  useAverage,
  useCeil,
  useClamp,
  useFloor,
  useMax,
  useMin,
  usePrecision,
  useRound,
  useSum,
  useTrunc,
} from '@stacksjs/composables'
