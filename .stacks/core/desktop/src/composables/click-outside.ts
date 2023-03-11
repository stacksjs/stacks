import type { Ref } from 'vue'
import { onMounted, onUnmounted } from 'vue'

export function useClickOutside(targetElement: Ref<HTMLElement | null>, callback: Function) {
  const handleOutsideClick = (event: MouseEvent) => {
    if (targetElement.value && !targetElement.value.contains(event.target as Node) && !event.composedPath().includes(targetElement.value))
      return callback()
  }

  onMounted(() => {
    document.addEventListener('click', handleOutsideClick)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleOutsideClick)
  })
}
