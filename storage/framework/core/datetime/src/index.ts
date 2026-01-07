// Import directly from @vueuse/core to avoid circular dependency with @stacksjs/browser
import { useDateFormat, useNow } from '@vueuse/core'

export const now: typeof useNow = useNow
export const dateFormat: typeof useDateFormat = useDateFormat

export { format, parse } from '@formkit/tempo'
