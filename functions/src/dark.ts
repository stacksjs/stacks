import { useDark, useToggle } from '@vueuse/core'

// @vueuse/core APIs are auto-imported
export const isDark = useDark()
export const toggleDark = useToggle(isDark)
