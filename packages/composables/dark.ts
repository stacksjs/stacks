import { useDark, useToggle } from '@vueuse/core'

// these APIs should be auto-imported from @vueuse/core
export const isDark = useDark()
export const toggleDark = useToggle(isDark)
