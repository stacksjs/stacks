<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'

interface Props {
  variant?: 'macos' | 'windows'
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  disabled?: boolean
  // For background color adaptation
  adaptiveBackground?: boolean
  backgroundImageUrl?: string
  backgroundColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'macos',
  size: 'md',
  showLabels: false,
  disabled: false,
  adaptiveBackground: false,
})

const emit = defineEmits<{
  (e: 'minimize'): void
  (e: 'maximize'): void
  (e: 'close'): void
}>()

const isHovered = ref(false)
const extractedColors = ref<{ close: string; minimize: string; maximize: string } | null>(null)

// Size configurations
const sizeConfig = computed(() => {
  const sizes = {
    sm: { button: 'w-3 h-3', gap: 'gap-1.5', iconSize: 'w-2 h-2' },
    md: { button: 'w-3.5 h-3.5', gap: 'gap-2', iconSize: 'w-2.5 h-2.5' },
    lg: { button: 'w-4 h-4', gap: 'gap-2.5', iconSize: 'w-3 h-3' },
  }
  return sizes[props.size]
})

// Default macOS colors
const defaultColors = {
  close: { bg: '#ff5f57', hover: '#ff4136', icon: '#4c0002' },
  minimize: { bg: '#febc2e', hover: '#ffa500', icon: '#995700' },
  maximize: { bg: '#28c840', hover: '#00b300', icon: '#006400' },
}

// Extract dominant color from background image
async function extractColorFromImage(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      // Sample from top-left corner where window controls typically appear
      const sampleSize = 50
      canvas.width = sampleSize
      canvas.height = sampleSize
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize, 0, 0, sampleSize, sampleSize)

      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
      const data = imageData.data

      // Calculate average color
      let r = 0, g = 0, b = 0
      const pixelCount = data.length / 4

      for (let i = 0; i < data.length; i += 4) {
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
      }

      r = Math.round(r / pixelCount)
      g = Math.round(g / pixelCount)
      b = Math.round(b / pixelCount)

      resolve(`rgb(${r}, ${g}, ${b})`)
    }

    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}

// Calculate if text should be light or dark based on background
function getLuminance(color: string): number {
  const rgb = color.match(/\d+/g)
  if (!rgb || rgb.length < 3) return 0.5

  const r = parseInt(rgb[0]) / 255
  const g = parseInt(rgb[1]) / 255
  const b = parseInt(rgb[2]) / 255

  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// Adjust color opacity based on background
function adjustColorForBackground(baseColor: string, bgLuminance: number): string {
  // If background is dark, make colors slightly more vibrant
  // If background is light, keep colors as-is
  if (bgLuminance < 0.5) {
    return baseColor // Already vibrant for dark backgrounds
  }
  return baseColor
}

// Initialize adaptive colors
async function initAdaptiveColors() {
  if (!props.adaptiveBackground) return

  let bgColor: string | null = null

  if (props.backgroundImageUrl) {
    bgColor = await extractColorFromImage(props.backgroundImageUrl)
  } else if (props.backgroundColor) {
    bgColor = props.backgroundColor
  }

  if (bgColor) {
    const luminance = getLuminance(bgColor)
    // For now, we keep the standard colors but this could be enhanced
    // to create custom colors based on the background
    extractedColors.value = {
      close: adjustColorForBackground(defaultColors.close.bg, luminance),
      minimize: adjustColorForBackground(defaultColors.minimize.bg, luminance),
      maximize: adjustColorForBackground(defaultColors.maximize.bg, luminance),
    }
  }
}

onMounted(() => {
  initAdaptiveColors()
})

watch(() => [props.backgroundImageUrl, props.backgroundColor], () => {
  initAdaptiveColors()
})

function handleClose() {
  if (!props.disabled) emit('close')
}

function handleMinimize() {
  if (!props.disabled) emit('minimize')
}

function handleMaximize() {
  if (!props.disabled) emit('maximize')
}
</script>

<template>
  <div
    v-if="variant === 'macos'"
    :class="['flex items-center', sizeConfig.gap]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Close button -->
    <button
      type="button"
      :class="[
        sizeConfig.button,
        'rounded-full transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500/50',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        'group',
      ]"
      :style="{ backgroundColor: extractedColors?.close || defaultColors.close.bg }"
      :disabled="disabled"
      :title="showLabels ? undefined : 'Close'"
      @click="handleClose"
    >
      <svg
        v-show="isHovered && !disabled"
        :class="[sizeConfig.iconSize, 'mx-auto']"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        :style="{ color: defaultColors.close.icon }"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3l6 6M9 3l-6 6" />
      </svg>
    </button>

    <!-- Minimize button -->
    <button
      type="button"
      :class="[
        sizeConfig.button,
        'rounded-full transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-500/50',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        'group',
      ]"
      :style="{ backgroundColor: extractedColors?.minimize || defaultColors.minimize.bg }"
      :disabled="disabled"
      :title="showLabels ? undefined : 'Minimize'"
      @click="handleMinimize"
    >
      <svg
        v-show="isHovered && !disabled"
        :class="[sizeConfig.iconSize, 'mx-auto']"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        :style="{ color: defaultColors.minimize.icon }"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 6h8" />
      </svg>
    </button>

    <!-- Maximize button -->
    <button
      type="button"
      :class="[
        sizeConfig.button,
        'rounded-full transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500/50',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        'group',
      ]"
      :style="{ backgroundColor: extractedColors?.maximize || defaultColors.maximize.bg }"
      :disabled="disabled"
      :title="showLabels ? undefined : 'Maximize'"
      @click="handleMaximize"
    >
      <svg
        v-show="isHovered && !disabled"
        :class="[sizeConfig.iconSize, 'mx-auto']"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        :style="{ color: defaultColors.maximize.icon }"
      >
        <!-- Diagonal arrows for fullscreen -->
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2 2l3 3M10 10l-3-3M10 2l-3 3M2 10l3-3" />
      </svg>
    </button>
  </div>

  <!-- Windows style -->
  <div
    v-else
    class="flex items-center"
  >
    <!-- Minimize -->
    <button
      type="button"
      class="h-8 w-12 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors"
      :disabled="disabled"
      title="Minimize"
      @click="handleMinimize"
    >
      <svg class="w-3 h-0.5" fill="currentColor" viewBox="0 0 12 2">
        <rect width="12" height="2" />
      </svg>
    </button>

    <!-- Maximize -->
    <button
      type="button"
      class="h-8 w-12 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors"
      :disabled="disabled"
      title="Maximize"
      @click="handleMaximize"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 12 12">
        <rect x="1" y="1" width="10" height="10" stroke-width="1.5" />
      </svg>
    </button>

    <!-- Close -->
    <button
      type="button"
      class="h-8 w-12 flex items-center justify-center text-neutral-600 hover:bg-red-600 hover:text-white dark:text-neutral-400 transition-colors"
      :disabled="disabled"
      title="Close"
      @click="handleClose"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 12 12">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M1 1l10 10M11 1l-10 10" />
      </svg>
    </button>
  </div>
</template>
