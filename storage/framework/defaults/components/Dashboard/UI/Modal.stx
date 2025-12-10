<script setup lang="ts">
/**
 * Modal Component
 * A modern, accessible modal dialog.
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  persistent?: boolean // Prevent closing by overlay/escape
  centered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
  closeOnOverlay: true,
  closeOnEscape: true,
  persistent: false,
  centered: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const modalRef = ref<HTMLDivElement>()

// Size classes
const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
}

function close() {
  if (props.persistent) return
  emit('update:modelValue', false)
  emit('close')
}

function handleOverlayClick() {
  if (props.closeOnOverlay && !props.persistent) {
    close()
  }
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnEscape && !props.persistent) {
    close()
  }
}

// Lock body scroll when modal is open
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 overflow-y-auto"
      >
        <!-- Overlay -->
        <div
          class="fixed inset-0 bg-black/50 backdrop-blur-sm"
          @click="handleOverlayClick"
        />

        <!-- Modal container -->
        <div
          :class="[
            'flex min-h-full p-4',
            centered ? 'items-center justify-center' : 'items-start justify-center pt-16',
          ]"
        >
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-4"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-4"
          >
            <div
              v-if="modelValue"
              ref="modalRef"
              :class="[
                'relative w-full rounded-xl bg-white dark:bg-neutral-900 shadow-2xl',
                sizeClasses[size],
              ]"
              @click.stop
            >
              <!-- Header -->
              <div
                v-if="title || closable || $slots.header"
                class="flex items-start justify-between gap-4 p-6 border-b border-neutral-200 dark:border-neutral-700"
              >
                <div v-if="title || description" class="min-w-0">
                  <slot name="header">
                    <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
                      {{ title }}
                    </h3>
                    <p v-if="description" class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {{ description }}
                    </p>
                  </slot>
                </div>

                <!-- Close button -->
                <button
                  v-if="closable"
                  type="button"
                  class="p-2 -m-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                  @click="close"
                >
                  <div class="i-hugeicons-cancel-01 w-5 h-5" />
                </button>
              </div>

              <!-- Body -->
              <div class="p-6">
                <slot />
              </div>

              <!-- Footer -->
              <div
                v-if="$slots.footer"
                class="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 rounded-b-xl"
              >
                <slot name="footer" :close="close" />
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
