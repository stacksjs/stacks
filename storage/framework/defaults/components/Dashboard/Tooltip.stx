<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  text: {
    type: String,
    required: true
  },
  position: {
    type: String,
    default: 'bottom',
    validator: (value: string) => ['top', 'right', 'bottom', 'left'].includes(value)
  },
  dark: {
    type: Boolean,
    default: false
  },
  usePortal: {
    type: Boolean,
    default: false
  },
  alignment: {
    type: String,
    default: 'center',
    validator: (value: string) => ['left', 'center', 'right'].includes(value)
  }
})

const containerRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const tooltipPosition = ref({ top: '0px', left: '0px' })

// Calculate position of tooltip relative to its container
const calculatePosition = () => {
  if (!containerRef.value || !tooltipRef.value) return

  const containerRect = containerRef.value.getBoundingClientRect()
  const tooltipRect = tooltipRef.value.getBoundingClientRect()

  let top = 0
  let left = 0

  switch (props.position) {
    case 'bottom':
      top = containerRect.bottom + 10

      // Apply alignment for bottom position
      if (props.alignment === 'left') {
        left = containerRect.left
      } else if (props.alignment === 'right') {
        left = containerRect.right - tooltipRect.width
      } else { // center
        left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2)
      }
      break
    case 'top':
      top = containerRect.top - tooltipRect.height - 10

      // Apply alignment for top position
      if (props.alignment === 'left') {
        left = containerRect.left
      } else if (props.alignment === 'right') {
        left = containerRect.right - tooltipRect.width
      } else { // center
        left = containerRect.left + (containerRect.width / 2) - (tooltipRect.width / 2)
      }
      break
    case 'left':
      top = containerRect.top + (containerRect.height / 2) - (tooltipRect.height / 2)
      left = containerRect.left - tooltipRect.width - 10
      break
    case 'right':
      top = containerRect.top + (containerRect.height / 2) - (tooltipRect.height / 2)
      left = containerRect.right + 10
      break
  }

  // Ensure tooltip stays within viewport
  if (left < 10) left = 10
  if (left + tooltipRect.width > window.innerWidth - 10)
    left = window.innerWidth - tooltipRect.width - 10

  if (top < 10) top = 10
  if (top + tooltipRect.height > window.innerHeight - 10)
    top = window.innerHeight - tooltipRect.height - 10

  tooltipPosition.value = {
    top: `${top}px`,
    left: `${left}px`
  }
}

const showTooltip = () => {
  isVisible.value = true
  // Use nextTick to ensure the tooltip is rendered before calculating position
  nextTick(() => {
    calculatePosition()
  })
}

const hideTooltip = () => {
  isVisible.value = false
}

onMounted(() => {
  window.addEventListener('resize', calculatePosition)
  window.addEventListener('scroll', calculatePosition, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', calculatePosition)
  window.removeEventListener('scroll', calculatePosition, true)
})
</script>

<template>
  <div
    ref="containerRef"
    class="tooltip-container"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focus="showTooltip"
    @blur="hideTooltip"
  >
    <slot></slot>

    <!-- Use Teleport when usePortal is true -->
    <Teleport to="body" v-if="usePortal">
      <div
        v-show="isVisible"
        ref="tooltipRef"
        class="tooltip-portal"
        :class="[position, { 'dark-tooltip': dark }, `align-${alignment}`]"
        :style="tooltipPosition"
      >
        {{ text }}
        <div class="tooltip-arrow" :class="[position, `align-${alignment}`]"></div>
      </div>
    </Teleport>

    <!-- Regular tooltip when usePortal is false -->
    <span
      v-if="!usePortal"
      v-show="isVisible"
      class="tooltip"
      :class="[position, { 'dark-tooltip': dark }, `align-${alignment}`]"
    >
      {{ text }}
    </span>
  </div>
</template>

<style scoped>
.tooltip-container {
  position: relative;
  display: inline-flex;
}

.tooltip {
  visibility: visible;
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  text-align: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
  opacity: 1;
  transition: opacity 0.2s, visibility 0.2s;
}

.tooltip-portal {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  text-align: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 9999;
  opacity: 1;
  transition: opacity 0.2s;
  pointer-events: none;
}

.tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 5px solid transparent;
}

.tooltip-arrow.bottom {
  bottom: 100%;
  left: 50%;
  margin-left: -5px;
  border-bottom-color: rgba(0, 0, 0, 0.8);
}

.tooltip-arrow.top {
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-top-color: rgba(0, 0, 0, 0.8);
}

.tooltip-arrow.left {
  top: 50%;
  left: 100%;
  margin-top: -5px;
  border-left-color: rgba(0, 0, 0, 0.8);
}

.tooltip-arrow.right {
  top: 50%;
  right: 100%;
  margin-top: -5px;
  border-right-color: rgba(0, 0, 0, 0.8);
}

/* Position variations */
.tooltip.bottom {
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
}

.tooltip.bottom.align-left {
  left: 0;
  transform: none;
}

.tooltip.bottom.align-right {
  left: auto;
  right: 0;
  transform: none;
}

.tooltip.top {
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
}

.tooltip.top.align-left {
  left: 0;
  transform: none;
}

.tooltip.top.align-right {
  left: auto;
  right: 0;
  transform: none;
}

.tooltip.left {
  left: -8px;
  top: 50%;
  transform: translate(-100%, -50%);
}

.tooltip.right {
  right: -8px;
  top: 50%;
  transform: translate(100%, -50%);
}

/* Arrows for each position */
.tooltip.bottom::after,
.tooltip-portal.bottom .tooltip-arrow {
  content: "";
  position: absolute;
  bottom: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: transparent transparent rgba(0, 0, 0, 0.8) transparent;
}

.tooltip.bottom.align-left::after,
.tooltip-portal.bottom.align-left .tooltip-arrow {
  left: 10px;
  margin-left: 0;
}

.tooltip.bottom.align-right::after,
.tooltip-portal.bottom.align-right .tooltip-arrow {
  left: auto;
  right: 10px;
  margin-left: 0;
}

.tooltip.top::after,
.tooltip-portal.top .tooltip-arrow {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

.tooltip.top.align-left::after,
.tooltip-portal.top.align-left .tooltip-arrow {
  left: 10px;
  margin-left: 0;
}

.tooltip.top.align-right::after,
.tooltip-portal.top.align-right .tooltip-arrow {
  left: auto;
  right: 10px;
  margin-left: 0;
}

.tooltip.left::after,
.tooltip-portal.left .tooltip-arrow {
  content: "";
  position: absolute;
  top: 50%;
  left: 100%;
  margin-top: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: transparent transparent transparent rgba(0, 0, 0, 0.8);
}

.tooltip.right::after,
.tooltip-portal.right .tooltip-arrow {
  content: "";
  position: absolute;
  top: 50%;
  right: 100%;
  margin-top: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: transparent rgba(0, 0, 0, 0.8) transparent transparent;
}

/* Dark mode adjustments */
.dark-tooltip {
  background-color: rgba(255, 255, 255, 0.8);
  color: #1e293b;
}

.dark-tooltip.tooltip-arrow.bottom,
.dark-tooltip.bottom::after,
.dark-tooltip.tooltip-portal.bottom .tooltip-arrow {
  border-bottom-color: rgba(255, 255, 255, 0.8);
}

.dark-tooltip.tooltip-arrow.top,
.dark-tooltip.top::after,
.dark-tooltip.tooltip-portal.top .tooltip-arrow {
  border-top-color: rgba(255, 255, 255, 0.8);
}

.dark-tooltip.tooltip-arrow.left,
.dark-tooltip.left::after,
.dark-tooltip.tooltip-portal.left .tooltip-arrow {
  border-left-color: rgba(255, 255, 255, 0.8);
}

.dark-tooltip.tooltip-arrow.right,
.dark-tooltip.right::after,
.dark-tooltip.tooltip-portal.right .tooltip-arrow {
  border-right-color: rgba(255, 255, 255, 0.8);
}
</style>
