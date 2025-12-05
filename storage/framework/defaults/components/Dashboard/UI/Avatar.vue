<script lang="ts" setup>
import { computed, ref } from 'vue'

interface Props {
  src?: string
  alt?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  rounded?: 'sm' | 'md' | 'lg' | 'full'
  status?: 'online' | 'offline' | 'away' | 'busy'
  fallbackIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  rounded: 'full',
  fallbackIcon: true,
})

const imageError = ref(false)

const initials = computed(() => {
  if (!props.name) return ''
  const parts = props.name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

const showFallback = computed(() => !props.src || imageError.value)

const sizeClasses = computed(() => {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-14 w-14 text-xl',
    '2xl': 'h-16 w-16 text-2xl',
  }
  return sizes[props.size]
})

const radiusClasses = computed(() => {
  const radii = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }
  return radii[props.rounded]
})

const statusClasses = computed(() => {
  if (!props.status) return null

  const colors = {
    online: 'bg-green-500',
    offline: 'bg-neutral-400',
    away: 'bg-amber-500',
    busy: 'bg-red-500',
  }

  const sizeDot = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-3.5 w-3.5',
    '2xl': 'h-4 w-4',
  }

  return [
    'absolute bottom-0 right-0',
    'rounded-full',
    'ring-2 ring-white dark:ring-neutral-800',
    colors[props.status],
    sizeDot[props.size],
  ]
})

// Generate a consistent background color based on name
const bgColorClass = computed(() => {
  if (!props.name) return 'bg-neutral-200 dark:bg-neutral-700'

  const colors = [
    'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
    'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400',
    'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
    'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
    'bg-lime-100 text-lime-600 dark:bg-lime-900/50 dark:text-lime-400',
    'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
    'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400',
    'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400',
    'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400',
    'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
    'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400',
    'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
    'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/50 dark:text-fuchsia-400',
    'bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400',
    'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400',
  ]

  // Simple hash function to get consistent color
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
})

function handleImageError() {
  imageError.value = true
}
</script>

<template>
  <div class="relative inline-flex flex-shrink-0">
    <!-- Image avatar -->
    <img
      v-if="!showFallback"
      :src="src"
      :alt="alt || name || 'Avatar'"
      :class="[sizeClasses, radiusClasses, 'object-cover']"
      @error="handleImageError"
    />

    <!-- Fallback: Initials or Icon -->
    <div
      v-else
      :class="[
        sizeClasses,
        radiusClasses,
        bgColorClass,
        'inline-flex items-center justify-center font-medium',
      ]"
    >
      <span v-if="initials">{{ initials }}</span>
      <svg
        v-else-if="fallbackIcon"
        class="w-1/2 h-1/2 text-neutral-400"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- Status indicator -->
    <span v-if="status" :class="statusClasses" />
  </div>
</template>
