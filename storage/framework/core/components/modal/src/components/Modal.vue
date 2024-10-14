<script lang="ts" setup>
import { computed, withDefaults } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean,
  showHeader?: boolean,
  className?: string,
  title?: string,
  titleClassName?: string,
}>(), {
  visible: true,
  showHeader: true,
  title: '',
})

const emit = defineEmits<{
  (event: 'close', visible: boolean): void
}>()

const hasTitle = computed(() => props.title !== '')
const isVisible = computed(() => props.visible)

const handleClose = () => {
  emit('close', false)
}
</script>

<template>
  <div class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true" v-if="isVisible">
  <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

  <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">

        <div class="absolute right-0 top-0  pr-4 pt-4 sm:block" v-if="showHeader">
          <button type="button" class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" @click="handleClose">
            <span class="sr-only">Close</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex items-center justify-between" v-if="hasTitle">
          <div class="text-lg font-medium text-gray-900" v-if="title">{{ title }}</div>
        </div>
        <div class="mt-5 flex">
          <slot />
        </div>
      </div>
    </div>
  </div>
</div>
</template>
