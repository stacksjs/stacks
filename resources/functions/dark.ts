import { useDark, usePreferredDark } from '@stacksjs/stx/composables'
import { state } from '@stacksjs/stx'

const dark = useDark()
const preferred = usePreferredDark()
const darkValue = state(dark.isDark)
const preferredValue = state(preferred.matches)

dark.subscribe(value => darkValue.set(value))
preferred.subscribe(value => preferredValue.set(value))

export function isDark(): boolean {
  return darkValue()
}

export function preferredDark(): boolean {
  return preferredValue()
}

export function toggleDark(): void {
  dark.toggle()
}
