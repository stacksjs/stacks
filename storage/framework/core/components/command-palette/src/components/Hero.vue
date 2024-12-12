<script lang="ts" setup>
import { useMagicKeys } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import Linear from './command/Linear.vue'
import Raycast from './command/raycast/Raycast.vue'
import Vercel from './command/vercel/Vercel.vue'

const isOpenDialog = ref(false)
const isOpenThemeDialog = ref(false)
const selectedView = ref('')
// const target = ref(null)
const currentDialog = computed(() => {
  if (selectedView.value === 'Linear')
    return Linear
  if (selectedView.value === 'Vercel')
    return Vercel
  if (selectedView.value === 'Raycast')
    return Raycast
  return Linear
})

const keys = useMagicKeys()
const CmdK = keys['Meta+K']
const Escape = keys.Escape

function handleChangeDialog(view = 'self') {
  const isSelf = view === 'self'
  selectedView.value = view
  isOpenDialog.value = isSelf
  isOpenThemeDialog.value = !isSelf
}
function handleOpenDialog(value: any) {
  if (value)
    isOpenDialog.value = true
  else
    isOpenDialog.value = false
}

watch(CmdK, (v) => {
  if (v) {
    console.log('Meta + K has been pressed')
    isOpenDialog.value = true
  }
})
watch(Escape, (v) => {
  if (v) {
    console.log('Escape has been pressed')
    isOpenDialog.value = false
    isOpenThemeDialog.value = false
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="command-pallete-wrapper">
      <div class="toast" />
      <div class="toast" />
      <div class="toast" />
    </div>
    <h1 class="text-neon mb-3 text-5xl font-bold -mt-5">
      stacks/command-palette
    </h1>
    <p class="mb-3 mt-0 text-lg">
      An opinionated command palette component for Stacks.
    </p>
    <div class="flex gap-2">
      <div class="relative z-20 mr-auto inline-block flex text-left">
        <button
          class="btn-primary w-full flex cursor-pointer items-center justify-center rounded-md px-6 py-2 text-lg text-white font-semibold transition sm:w-auto space-x-3"
          @click="isOpenDialog = true"
        >
          <span>Try it out</span>
          <span class="hidden sm:inline-flex space-x-1">
            <span
              class="rounded from-white via-white to-gray-200 bg-gradient-to-b px-1 pb-0.5 pt-px text-sm text-gray-800"
            >
              ⌘
            </span>
            <span
              class="rounded from-white via-white to-gray-200 bg-gradient-to-b px-1 pb-0.5 pt-px text-sm text-gray-800"
            >
              K
            </span>
          </span>
        </button>
      </div>

      <a
        class="button btn-secondary"
        href="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/command-palette"
        target="_blank"
      >
        GitHub
      </a>
    </div>
    <div class="mx-auto w-full">
      <Self
        :visible="isOpenDialog"
        @dialog="handleOpenDialog"
        @select="handleChangeDialog"
      />
      <component :is="currentDialog" v-if="isOpenThemeDialog" />
    </div>
  </div>
</template>

<style scoped>
.command-pallete-wrapper {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  height: 100px;
  width: 400px;
  position: relative;
  -webkit-mask-image: linear-gradient(to top, transparent 0%, black 35%);
  mask-image: linear-gradient(to top, transparent 0%, black 35%);
  opacity: 1;
}

.toast {
  width: 356px;
  height: 40px;
  background: #ffffff;
  box-shadow: 0 4px 12px #0000001a;
  border: 1px solid #f5f5f5;
  border-radius: 6px;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.toast:nth-child(1) {
  transform: translateY(-60%) translateX(-50%) scale(0.9);
}

.toast:nth-child(2) {
  transform: translateY(-30%) translateX(-50%) scale(0.95);
}

.button {
  height: 40px;
  border-radius: 6px;
  border: none;
  padding: 0 30px;
  font-weight: 600;
  flex-shrink: 0;
  font-family: inherit;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 0px 0px rgba(0, 0, 0, 0.08), 0px 2px 2px 0px rgba(0, 0, 0, 0.04),
    0px 3px 3px 0px rgba(0, 0, 0, 0.02), 0px 4px 4px 0px rgba(0, 0, 0, 0.01);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
  color: hsl(0, 0%, 9%);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  transition: box-shadow 200ms, background 200ms;
}

.btn-secondary {
  background: linear-gradient(
    156deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(240, 240, 240, 1) 100%
  );
}

.button:focus-visible {
  outline: none;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 0px 0px rgba(0, 0, 0, 0.08), 0px 2px 2px 0px rgba(0, 0, 0, 0.04),
    0px 3px 3px 0px rgba(0, 0, 0, 0.02), 0px 4px 4px 0px rgba(0, 0, 0, 0.01),
    0 0 0 2px rgba(0, 0, 0, 0.15);
}

.button:after {
  content: '';
  position: absolute;
  top: 100%;
  background: blue;
  left: 0;
  width: 100%;
  height: 35%;
  background: linear-gradient(
    to top,
    hsl(0, 0%, 91%) 0%,
    hsla(0, 0%, 91%, 0.987) 8.1%,
    hsla(0, 0%, 91%, 0.951) 15.5%,
    hsla(0, 0%, 91%, 0.896) 22.5%,
    hsla(0, 0%, 91%, 0.825) 29%,
    hsla(0, 0%, 91%, 0.741) 35.3%,
    hsla(0, 0%, 91%, 0.648) 41.2%,
    hsla(0, 0%, 91%, 0.55) 47.1%,
    hsla(0, 0%, 91%, 0.45) 52.9%,
    hsla(0, 0%, 91%, 0.352) 58.8%,
    hsla(0, 0%, 91%, 0.259) 64.7%,
    hsla(0, 0%, 91%, 0.175) 71%,
    hsla(0, 0%, 91%, 0.104) 77.5%,
    hsla(0, 0%, 91%, 0.049) 84.5%,
    hsla(0, 0%, 91%, 0.013) 91.9%,
    hsla(0, 0%, 91%, 0) 100%
  );
  opacity: 0.6;
  transition: transform 200ms;
}

.btn-secondary:hover:after {
  transform: translateY(-100%);
}

@media (max-width: 600px) {
  .command-pallete-wrapper {
    width: 100%;
  }
}
</style>
