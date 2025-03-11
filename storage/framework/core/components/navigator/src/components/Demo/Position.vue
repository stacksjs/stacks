<script lang="ts" setup>
import type { PropType } from 'vue'
import type { Position } from '../../types'
import { computed, ref } from 'vue'
import { notification } from '../../'
import { useCopyCode } from '../../composables/Demo/useCopyCode'

const props = defineProps({
  position: String as PropType<Position>,
})

const emit = defineEmits<(e: 'update:position', position: Position) => void>()

const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const

const renderedCode = computed(() => {
  return `<Notification position="${props.position}" />`
})
const showCheckIcon = ref(false)

function handleChangePosition(activePosition: Position) {
  const toastsAmount = document.querySelectorAll('[data-sonner-toast]').length
  emit('update:position', activePosition)

  // No need to show a toast when there is already one
  if (toastsAmount > 0 && props.position !== activePosition)
    return

  notification('Event has been created', {
    description: 'Monday, January 3rd at 6:00pm',
  })
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
  notification('Copied to your clipboard!!!')
}
</script>

<template>
  <div class="types">
    <h1 class="my-2 text-lg font-semibold">
      Position
    </h1>
    <p class="my-3 text-base">
      You can customize the type of toast you want to render, and pass an
      options object as the second argument.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        v-for="pos in positions"
        :key="pos"
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': props.position === pos,
        }"
        @click="() => handleChangePosition(pos)"
      >
        {{ pos }}
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
