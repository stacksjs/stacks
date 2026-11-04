/**
 * The classes a dashboard `<Badge>` renders.
 *
 * A pure function of the props, shared by the badge's server render (the first
 * paint) and its client script (every later value). The client half is why
 * this is a module: most callers bind `:variant` to data that arrives after
 * hydration, the class computed at the server render never changed, and every
 * such badge stayed the default grey (stacksjs/stacks#3179). A server script's
 * function cannot cross to the client, so both halves import it from here.
 */

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg'

const sizeClasses: Record<string, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-[12px] px-2.5 py-0.5',
  lg: 'text-[13px] px-3 py-1'
}

const solidVariants: Record<string, string> = {
  default: 'bg-black/[0.06] text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
  primary: 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400',
  success: 'bg-green-500/15 text-green-600 dark:bg-green-400/20 dark:text-green-400',
  warning: 'bg-orange-500/15 text-orange-600 dark:bg-orange-400/20 dark:text-orange-400',
  danger: 'bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-400',
  info: 'bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/20 dark:text-cyan-400'
}

const outlineVariants: Record<string, string> = {
  default: 'border border-black/15 text-neutral-600 dark:border-white/20 dark:text-neutral-300',
  primary: 'border border-blue-500/40 text-blue-600 dark:border-blue-400/50 dark:text-blue-400',
  success: 'border border-green-500/40 text-green-600 dark:border-green-400/50 dark:text-green-400',
  warning: 'border border-orange-500/40 text-orange-600 dark:border-orange-400/50 dark:text-orange-400',
  danger: 'border border-red-500/40 text-red-600 dark:border-red-400/50 dark:text-red-400',
  info: 'border border-cyan-500/40 text-cyan-600 dark:border-cyan-400/50 dark:text-cyan-400'
}

const dotColors: Record<string, string> = {
  default: 'bg-neutral-400 dark:bg-neutral-500',
  primary: 'bg-blue-500 dark:bg-blue-400',
  success: 'bg-green-500 dark:bg-green-400',
  warning: 'bg-orange-500 dark:bg-orange-400',
  danger: 'bg-red-500 dark:bg-red-400',
  info: 'bg-cyan-500 dark:bg-cyan-400'
}

/**
 * A prop that arrived as an attribute is a string, so `outline="false"` must
 * not read as on.
 */
function flag(value: unknown): boolean {
  return value === true || value === 'true' || value === ''
}

export function badgeClasses(variant: unknown = 'default', size: unknown = 'sm', rounded: unknown = 'full', outline: unknown = false): string {
  return [
    'inline-flex items-center font-medium tracking-tight',
    'transition-all duration-150',
    sizeClasses[String(size)] ?? sizeClasses.sm,
    rounded === 'full' ? 'rounded-full' : 'rounded-md',
    (flag(outline) ? outlineVariants : solidVariants)[String(variant)] ?? solidVariants.default,
  ].join(' ')
}

export function badgeDotClasses(variant: unknown = 'default'): string {
  return `w-1.5 h-1.5 rounded-full mr-1.5 ${dotColors[String(variant)] ?? dotColors.default}`
}

export function badgeShowsDot(dot: unknown): boolean {
  return flag(dot)
}
