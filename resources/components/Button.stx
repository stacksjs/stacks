<script setup lang="ts">
/**
 * Marketing Button Component
 *
 * A simple button designed for marketing pages with solid/outline variants.
 * NOTE: For dashboard/app UIs, use @stacksjs/stx-ui components instead.
 */
import { computed } from 'vue'

const props = defineProps<{
  variant?: 'solid' | 'outline'
  color?: 'blue' | 'slate' | 'white' | 'black'
  href?: string
  className?: string
}>()

const baseStyles = {
  solid:
    'group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors',
  outline:
    'group inline-flex ring-1 items-center justify-center rounded-full py-2 px-4 text-sm focus:outline-none transition-colors',
}

const variantStyles = {
  solid: {
    slate:
      'bg-slate-900 text-white hover:bg-slate-700 hover:text-slate-100 active:bg-slate-800 active:text-slate-300 focus-visible:outline-slate-900',
    blue: 'bg-blue-600 text-white hover:text-slate-100 hover:bg-blue-500 active:bg-blue-800 active:text-blue-100 focus-visible:outline-blue-600',
    white:
      'bg-white text-slate-900 hover:bg-blue-50 active:bg-blue-200 active:text-slate-600 focus-visible:outline-white',
    black: 'bg-black text-white hover:bg-gray-800 active:bg-gray-900 active:text-gray-200 focus-visible:outline-black',
  },
  outline: {
    slate:
      'ring-slate-200 text-slate-700 hover:text-slate-900 hover:ring-slate-300 active:bg-slate-100 active:text-slate-600 focus-visible:outline-blue-600 focus-visible:ring-slate-300',
    blue: 'ring-blue-200 text-blue-700 hover:text-blue-900 hover:ring-blue-300 active:bg-blue-100 active:text-blue-600 focus-visible:outline-blue-600',
    white:
      'ring-slate-700 text-white hover:ring-slate-500 active:ring-slate-700 active:text-slate-400 focus-visible:outline-white',
    black: 'ring-black text-black hover:ring-gray-700 active:bg-gray-100 focus-visible:outline-black',
  },
}

const className = computed(() => {
  const variant = props.variant ?? 'solid'
  const color = props.color ?? 'slate'
  let classes = baseStyles[variant]

  const colorStyles = variantStyles[variant]?.[color]
  if (colorStyles) {
    classes += ` ${colorStyles}`
  }

  if (props.className) {
    classes += ` ${props.className}`
  }

  return classes
})
</script>

<template>
  <button v-if="!props.href" :class="className">
    <slot />
  </button>
  <a v-else :href="href" :class="className">
    <slot />
  </a>
</template>
