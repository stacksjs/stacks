import { computed, reactive, toRefs } from 'vue'

interface FilteredItem {
  count: number
  items: Map<string, any>
  groups: Set<string>
}

interface State {
  // Event State
  selectedNode: string
  selectedGroup: string
  shouldRerender: boolean
  // Input State
  search: string
  filtered: FilteredItem
}

const state = reactive<State>({
  selectedNode: '',
  selectedGroup: '',
  shouldRerender: false,
  /** Value of the search query. */
  search: '',
  filtered: {
    /** The count of all visible items. */
    count: 0,
    /** Map from visible item id. */
    items: new Map(),
    /** Set of groups with at least one visible item. */
    groups: new Set(),
  },
})

function useCommandState() {
  const isSearching = computed(() => state.search !== '')

  const resetStore = () => {
    // reset the command state
    state.search = ''
    state.filtered.count = 0
    state.filtered.items = new Map()
    state.filtered.groups = new Set()
  }

  return {
    isSearching,
    resetStore,
    ...toRefs(state),
  }
}

export { useCommandState }
