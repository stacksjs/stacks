import { useDateFormat, useNow } from '@stacksjs/browser'

export const now: typeof useNow = useNow
export const dateFormat: typeof useDateFormat = useDateFormat

export { format, parse } from '@formkit/tempo'
