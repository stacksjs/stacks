<script lang="ts" setup>
/**
 * StatsCard Component - macOS Style
 * A statistics card with macOS-inspired clean design.
 */
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

// macOS system colors for trends
const trendClasses = computed(() => {
  if (trendDirection.value === 'up') {
    return 'text-green-500 dark:text-green-400' // macOS green
  } else if (trendDirection.value === 'down') {
    return 'text-red-500 dark:text-red-400' // macOS red
  }
  return 'text-neutral-500 dark:text-neutral-400'
})

// macOS-style softer icon backgrounds
const iconBgClasses = computed(() => {
  const colors = {
    primary: 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400',
    success: 'bg-green-500/15 text-green-600 dark:bg-green-400/20 dark:text-green-400',
    warning: 'bg-orange-500/15 text-orange-600 dark:bg-orange-400/20 dark:text-orange-400',
    danger: 'bg-red-500/15 text-red-600 dark:bg-red-400/20 dark:text-red-400',
    info: 'bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/20 dark:text-cyan-400',
    neutral: 'bg-black/[0.06] text-neutral-600 dark:bg-white/10 dark:text-neutral-400',
  }
  return colors[props.iconBg]
})
</script>

<template>
  <!-- macOS-style clean card -->
  <div
    class="bg-white dark:bg-neutral-800/90 rounded-xl border border-black/5 dark:border-white/5 p-5 transition-all duration-150 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <!-- Title - macOS style -->
        <p class="text-[13px] font-medium text-neutral-500 dark:text-neutral-400 truncate tracking-tight">
          {{ title }}
        </p>

        <!-- Value -->
        <div class="mt-1.5 flex items-baseline gap-2">
          <template v-if="loading">
            <div class="h-7 w-20 bg-black/5 dark:bg-white/10 rounded-md animate-pulse" />
          </template>
          <template v-else>
            <p class="text-[22px] font-semibold text-neutral-900 dark:text-white tracking-tight">
              {{ value }}
            </p>

            <!-- Trend indicator - macOS style -->
            <span
              v-if="trend !== undefined"
              :class="[trendClasses, 'inline-flex items-center text-[12px] font-medium']"
            >
              <!-- Up arrow -->
              <svg
                v-if="trendDirection === 'up'"
                class="h-3.5 w-3.5 mr-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
              </svg>
              <!-- Down arrow -->
              <svg
                v-else-if="trendDirection === 'down'"
                class="h-3.5 w-3.5 mr-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
              {{ Math.abs(trend) }}%
            </span>
          </template>
        </div>

        <!-- Subtitle / Trend Label -->
        <p
          v-if="subtitle || trendLabel"
          class="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400"
        >
          {{ trendLabel || subtitle }}
        </p>
      </div>

      <!-- Icon - macOS style with softer background -->
      <div
        v-if="icon || $slots.icon"
        :class="[iconBgClasses, 'p-2.5 rounded-lg flex-shrink-0']"
      >
        <slot name="icon">
          <div v-if="icon" :class="[icon, 'h-5 w-5']" />
        </slot>
      </div>
    </div>

    <!-- Optional chart/sparkline slot -->
    <div v-if="$slots.chart" class="mt-4">
      <slot name="chart" />
    </div>

    <!-- Optional footer slot -->
    <div v-if="$slots.footer" class="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
      <slot name="footer" />
    </div>
  </div>
</template>
