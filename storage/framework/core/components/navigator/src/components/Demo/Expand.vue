<script lang="ts" setup>
import { computed, ref } from 'vue'
import { notification } from '../../'
import { useCopyCode } from '../../composables/Demo/useCopyCode'

const props = defineProps({
  expand: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<(e: 'update:expand', expand: boolean) => void>()

const renderedCode = computed(() => {
  return `<Notification :expand="${props.expand}" />`
})
const showCheckIcon = ref(false)

function handleChangeExpand(isExpand: boolean) {
  emit('update:expand', isExpand)

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
      Expand
    </h1>
    <p class="my-3 text-base">
      You can change the number of visible toasts through the
      <code class="mx-1 rounded-md p-1 text-xs !bg-neutral-200/66">
        visibleToasts
      </code>
      prop, the default is 3 toasts.
    </p>
    <div class="mb-4 flex gap-3 overflow-auto">
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': props.expand,
        }"
        @click="() => handleChangeExpand(true)"
      >
        Expand
      </button>
      <button
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50': !props.expand,
        }"
        @click="() => handleChangeExpand(false)"
      >
        Default
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
