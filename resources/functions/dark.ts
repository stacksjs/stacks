// Dark mode toggle — uses stx composables (globals from stx.d.ts)
export const isDark = useDark()
export function toggleDark() {
  isDark.set(!isDark())
}
