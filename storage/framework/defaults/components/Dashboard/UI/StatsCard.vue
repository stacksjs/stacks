<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  trend?: number // Percentage change (positive or negative)
  trendLabel?: string
  icon?: string
  iconBg?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  iconBg: 'primary',
  loading: false,
})

const trendDirection = computed(() => {
  if (props.trend === undefined || props.trend === 0) return 'neutral'
  return props.trend > 0 ? 'up' : 'down'
})

const trendClasses = computed(() => {
  if (trendDirection.value === 'up') {
    return 'text-green-600 dark:text-green-400'
  } else if (trendDirection.value === 'down') {
    return 'text-red-600 dark:text-red-400'
  }
  return 'text-neutral-500 dark:text-neutral-400'
})

const iconBgClasses = computed(() => {
  const colors = {
    primary: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
    info: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400',
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400',
  }
  return colors[props.iconBg]
})
</script>

<template>
  <div
    class="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 transition-all duration-200 hover:shadow-md"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <!-- Title -->
        <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400 truncate">
          {{ title }}
        </p>

        <!-- Value -->
        <div class="mt-2 flex items-baseline gap-2">
          <template v-if="loading">
            <div class="h-8 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </template>
          <template v-else>
            <p class="text-2xl font-semibold text-neutral-900 dark:text-white">
              {{ value }}
            </p>

            <!-- Trend indicator -->
            <span
              v-if="trend !== undefined"
              :class="[trendClasses, 'inline-flex items-center text-sm font-medium']"
            >
              <!-- Up arrow -->
              <svg
                v-if="trendDirection === 'up'"
                class="h-4 w-4 mr-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l5-5 5 5M7 7l5 5 5-5" />
              </svg>
              <!-- Down arrow -->
              <svg
                v-else-if="trendDirection === 'down'"
                class="h-4 w-4 mr-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 7l-5 5-5-5m10 10l-5-5-5 5" />
              </svg>
              {{ Math.abs(trend) }}%
            </span>
          </template>
        </div>

        <!-- Subtitle / Trend Label -->
        <p
          v-if="subtitle || trendLabel"
          class="mt-1 text-sm text-neutral-500 dark:text-neutral-400"
        >
          {{ trendLabel || subtitle }}
        </p>
      </div>

      <!-- Icon -->
      <div
        v-if="icon || $slots.icon"
        :class="[iconBgClasses, 'p-3 rounded-xl flex-shrink-0']"
      >
        <slot name="icon">
          <div v-if="icon" :class="[icon, 'h-6 w-6']" />
        </slot>
      </div>
    </div>

    <!-- Optional chart/sparkline slot -->
    <div v-if="$slots.chart" class="mt-4">
      <slot name="chart" />
    </div>

    <!-- Optional footer slot -->
    <div v-if="$slots.footer" class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
      <slot name="footer" />
    </div>
  </div>
</template>
