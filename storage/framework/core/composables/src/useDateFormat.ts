import type { Ref } from '@stacksjs/stx'
import { computed, ref } from '@stacksjs/stx'
import { format } from '@stacksjs/datetime'

/**
 * Reactive date formatting composable.
 * Returns a ref containing the formatted date string.
 * Uses @stacksjs/datetime format() under the hood.
 *
 * @param date - Date value (or ref) to format
 * @param formatStr - Token-based format string (e.g. 'YYYY-MM-DD HH:mm:ss')
 */
export function useDateFormat(date: Ref<Date | string | number> | Date | string | number, formatStr: string): Ref<string> {
  if (typeof date === 'object' && date !== null && 'value' in date && 'subscribe' in date) {
    return computed(() => {
      const d = (date as Ref<Date | string | number>).value
      return format(d instanceof Date ? d : new Date(d), formatStr)
    })
  }

  const d = date instanceof Date ? date : new Date(date as string | number)
  return ref(format(d, formatStr))
}
