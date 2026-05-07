// Dark mode toggle — uses stx composables (globals from stx.d.ts).
// `preferredDark` exposes the OS-level color-scheme preference so pages
// can render an "Auto" mode without overriding what the user picked.
export const isDark = useDark()
export const preferredDark = usePreferredDark()
export function toggleDark() {
  isDark.set(!isDark())
}
