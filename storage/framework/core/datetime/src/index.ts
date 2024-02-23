import { useDateFormat, useNow } from '@stacksjs/utils'

const now = useNow
const dateFormat = useDateFormat

// useNow and useDateFormat are exported from @stacksjs/utils
export { now, dateFormat }

export { format, parse } from '@formkit/tempo'
