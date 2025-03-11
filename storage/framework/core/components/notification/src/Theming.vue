<script lang="ts" setup>
import { computed, ref } from 'vue'
import { notification } from '.'
import { useCopyCode } from './composables/useCopyCode'

const emit = defineEmits(['setTheme'])

const currentAction = ref('light')
const showCheckIcon = ref(false)

const renderedCode = computed(() => {
  return currentAction.value === 'light' ? `<Notification theme="light" />` : `<Notification theme="dark" />`
})

function handleClick(action: string) {
  currentAction.value = action
  emit('setTheme', action)
  notification('Event has been created')
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
  notification('Copied to your clipboard!!!')
}
</script>

<template>
  <div class="types">
    <h1 class="my-2 text-lg font-semibold">
      Theme
    </h1>
    <p class="my-3 text-base">
      You can smoothly switch between light mode and dark mode.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentAction === 'light',
        }"
        @click="(e) => handleClick('light')"
      >
        Light
      </button>
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': currentAction === 'dark',
        }"
        @click="(e) => handleClick('dark')"
      >
        Dark
      </button>
    </div>
    <div class="group code-block relative">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="renderedCode"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
  </div>
</template>
