export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

export function rand(min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// not, -> exported as well in ../regex
export {
  and,
  createGenericProjection,
  createProjection,
  logicNot,
  logicOr,
  or,
  useAbs,
  useAverage,
  useCeil,
  useClamp,
  useFloor,
  useMath,
  useMax,
  useMin,
  usePrecision,
  useProjection,
  useRound,
  useSum,
  useTrunc,
} from '@vueuse/math'
