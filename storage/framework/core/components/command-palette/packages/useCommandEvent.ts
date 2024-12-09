import { ref } from 'vue'
import type { ItemInfo } from './types'

export interface Events {
  selectItem: ItemInfo
  rerenderList: boolean
}

function useCommandEvent() {
  const itemInfo = ref<ItemInfo>()
  const rerenderList = ref(false)

  return {
    itemInfo,
    rerenderList,
  }
}

export { useCommandEvent }
