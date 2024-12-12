<script setup lang="ts">
const props = defineProps<{
  variant?: 'solid' | 'outline'
  color?: 'blue' | 'slate' | 'white'
  href?: string
  className?: string
}>()

const baseStyles = {
  solid:
    'group inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
  outline: 'group inline-flex ring-1 items-center justify-center rounded-full py-2 px-4 text-sm focus:outline-none',
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
    white:
      'ring-slate-700 text-white hover:ring-slate-500 active:ring-slate-700 active:text-slate-400 focus-visible:outline-white',
  },
}

const className = computed(() => {
  let classes = baseStyles[props.variant ?? 'solid']

  if (props.variant === 'outline')
    classes += ` ${variantStyles.outline[props.color ?? 'slate']}`
  else if (props.variant === 'solid')
    classes += ` ${variantStyles.solid[props.color ?? 'slate']}`

  if (props.className)
    classes += ` ${props.className}`

  return classes
})

// easily use any of the lifecycle hooks without needing to import them
onMounted(() => {
  // eslint-disable-next-line no-console
  console.log('Button component mounted')
})
</script>

<template>
  <button v-if="!props.href" :class="className">
    <slot />
  </button>
  <a v-else :class="className">
    <slot />
  </a>
</template>
