import type { ItemInfo } from './types'
import { ref } from 'vue'

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
