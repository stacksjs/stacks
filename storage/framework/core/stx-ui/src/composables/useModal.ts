/**
 * useModal Composable
 * Reactive modal state management.
 */
import { ref, computed, watch, onUnmounted } from 'vue'

export interface UseModalOptions {
  /**
   * Initial open state.
   */
  initialOpen?: boolean
  /**
   * Close when clicking outside.
   */
  closeOnClickOutside?: boolean
  /**
   * Close when pressing Escape.
   */
  closeOnEscape?: boolean
  /**
   * Lock body scroll when modal is open.
   */
  lockScroll?: boolean
  /**
   * Callback when modal opens.
   */
  onOpen?: () => void
  /**
   * Callback when modal closes.
   */
  onClose?: () => void
}

export interface UseModalReturn {
  /**
   * Whether the modal is open.
   */
  isOpen: ReturnType<typeof ref<boolean>>
  /**
   * Open the modal.
   */
  open: () => void
  /**
   * Close the modal.
   */
  close: () => void
  /**
   * Toggle the modal.
   */
  toggle: () => void
  /**
   * Props to spread on the modal component.
   */
  modalProps: ReturnType<typeof computed<{
    modelValue: boolean
    'onUpdate:modelValue': (value: boolean) => void
  }>>
  /**
   * Props to spread on the trigger element.
   */
  triggerProps: ReturnType<typeof computed<{
    onClick: () => void
    'aria-haspopup': 'dialog'
    'aria-expanded': boolean
  }>>
}

export function useModal(options: UseModalOptions = {}): UseModalReturn {
  const {
    initialOpen = false,
    closeOnEscape = true,
    lockScroll = true,
    onOpen,
    onClose,
  } = options

  const isOpen = ref(initialOpen)
  let previousOverflow = ''

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && closeOnEscape) {
      close()
    }
  }

  function lockBodyScroll() {
    if (typeof document !== 'undefined') {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
  }

  function unlockBodyScroll() {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = previousOverflow
    }
  }

  // Watch for state changes
  watch(isOpen, (newValue, oldValue) => {
    if (newValue && !oldValue) {
      // Opening
      if (lockScroll) lockBodyScroll()
      if (closeOnEscape && typeof document !== 'undefined') {
        document.addEventListener('keydown', handleEscape)
      }
      onOpen?.()
    } else if (!newValue && oldValue) {
      // Closing
      if (lockScroll) unlockBodyScroll()
      if (closeOnEscape && typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleEscape)
      }
      onClose?.()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (isOpen.value) {
      if (lockScroll) unlockBodyScroll()
      if (closeOnEscape && typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  })

  const modalProps = computed(() => ({
    modelValue: isOpen.value,
    'onUpdate:modelValue': (value: boolean) => {
      isOpen.value = value
    },
  }))

  const triggerProps = computed(() => ({
    onClick: toggle,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': isOpen.value,
  }))

  return {
    isOpen,
    open,
    close,
    toggle,
    modalProps,
    triggerProps,
  }
}
