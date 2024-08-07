<script lang="ts" setup>
import type { PropType } from 'vue'
import { computed, ref } from 'vue'
// import { notification } from '../'
import { useCopyCode } from '../composables/useCopyCode'
import type { Position } from '../types'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

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
  if (toastsAmount > 0 && props.position !== activePosition) return

  // notification('Event has been created', {
  //   description: 'Monday, January 3rd at 6:00pm',
  // })
}

async function handleCopyCode() {
  await useCopyCode({ code: renderedCode.value, checkIconRef: showCheckIcon })
  // notification('Copied to your clipboard!')
}
</script>

<template>
  <div class="types">
    <h1 class="text-lg font-semibold my-2">
      Position
    </h1>
    <p class="text-base my-3">
      You can customize the type of toast you want to render, and pass an
      options object as the second argument.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        v-for="position in positions"
        :key="position"
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': props.position === position,
        }"
        @click="() => handleChangePosition(position)"
      >
        {{ position }}
      </button>
    </div>
    <div class="code-block relative group">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="renderedCode"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="absolute right-2 top-2 btn-border p-1 hidden group-hover:block"
        @click="handleCopyCode"
      >
        <CheckIcon v-if="showCheckIcon" />
        <CopyIcon v-else />
      </button>
    </div>
  </div>
</template>
