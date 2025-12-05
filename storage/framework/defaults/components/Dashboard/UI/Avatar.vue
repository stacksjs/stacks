<script lang="ts" setup>
/**
 * Avatar Component - macOS Style
 * A clean avatar with macOS-inspired styling.
 */
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

// macOS-style compact sizes
const sizeClasses = computed(() => {
  const sizes = {
    xs: 'h-5 w-5 text-[10px]',
    sm: 'h-7 w-7 text-[11px]',
    md: 'h-8 w-8 text-[12px]',
    lg: 'h-10 w-10 text-[13px]',
    xl: 'h-12 w-12 text-[14px]',
    '2xl': 'h-14 w-14 text-[16px]',
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

// macOS system colors for status dots
const statusClasses = computed(() => {
  if (!props.status) return null

  const colors = {
    online: 'bg-green-500', // macOS green #34c759
    offline: 'bg-neutral-400',
    away: 'bg-orange-500', // macOS orange #ff9500
    busy: 'bg-red-500', // macOS red #ff3b30
  }

  const sizeDot = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
    xl: 'h-3 w-3',
    '2xl': 'h-3.5 w-3.5',
  }

  return [
    'absolute bottom-0 right-0',
    'rounded-full',
    'ring-2 ring-white dark:ring-neutral-900',
    colors[props.status],
    sizeDot[props.size],
  ]
})

// macOS-style softer background colors
const bgColorClass = computed(() => {
  if (!props.name) return 'bg-black/[0.06] text-neutral-500 dark:bg-white/10 dark:text-neutral-400'

  // macOS-inspired pastel colors
  const colors = [
    'bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-400',
    'bg-orange-500/15 text-orange-600 dark:bg-orange-400/20 dark:text-orange-400',
    'bg-yellow-500/15 text-yellow-600 dark:bg-yellow-400/20 dark:text-yellow-400',
    'bg-green-500/15 text-green-600 dark:bg-green-400/20 dark:text-green-400',
    'bg-teal-500/15 text-teal-600 dark:bg-teal-400/20 dark:text-teal-400',
    'bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/20 dark:text-cyan-400',
    'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400',
    'bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-400',
    'bg-purple-500/15 text-purple-600 dark:bg-purple-400/20 dark:text-purple-400',
    'bg-pink-500/15 text-pink-600 dark:bg-pink-400/20 dark:text-pink-400',
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
