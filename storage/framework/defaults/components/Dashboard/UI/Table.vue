<script setup lang="ts">
/**
 * Table Component
 * A modern, responsive data table with sorting, selection, and customization.
 */
import { ref, computed, watch } from 'vue'

interface Column {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
  class?: string
}

interface Props {
  columns: Column[]
  data: Record<string, any>[]
  loading?: boolean
  selectable?: boolean
  hoverable?: boolean
  striped?: boolean
  bordered?: boolean
  compact?: boolean
  stickyHeader?: boolean
  emptyTitle?: string
  emptyDescription?: string
  rowKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectable: false,
  hoverable: true,
  striped: false,
  bordered: false,
  compact: false,
  stickyHeader: false,
  emptyTitle: 'No data',
  emptyDescription: 'There are no items to display.',
  rowKey: 'id',
})

const emit = defineEmits<{
  (e: 'sort', column: string, direction: 'asc' | 'desc'): void
  (e: 'select', selectedRows: Record<string, any>[]): void
  (e: 'rowClick', row: Record<string, any>, index: number): void
}>()

// Sorting state
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

// Selection state
const selectedRows = ref<Set<any>>(new Set())
const isAllSelected = computed(() => {
  if (props.data.length === 0) return false
  return props.data.every((row) => selectedRows.value.has(row[props.rowKey]))
})
const isPartiallySelected = computed(() => {
  return selectedRows.value.size > 0 && !isAllSelected.value
})

// Alignment classes
function getAlignClass(align?: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

// Handle sort click
function handleSort(column: Column) {
  if (!column.sortable) return

  if (sortColumn.value === column.key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column.key
    sortDirection.value = 'asc'
  }

  emit('sort', column.key, sortDirection.value)
}

// Handle selection
function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedRows.value.clear()
  } else {
    props.data.forEach((row) => {
      selectedRows.value.add(row[props.rowKey])
    })
  }
  emitSelection()
}

function toggleRowSelection(row: Record<string, any>) {
  const key = row[props.rowKey]
  if (selectedRows.value.has(key)) {
    selectedRows.value.delete(key)
  } else {
    selectedRows.value.add(key)
  }
  emitSelection()
}

function emitSelection() {
  const selected = props.data.filter((row) =>
    selectedRows.value.has(row[props.rowKey])
  )
  emit('select', selected)
}

// Handle row click
function handleRowClick(row: Record<string, any>, index: number) {
  emit('rowClick', row, index)
}

// Watch for data changes to clear invalid selections
watch(() => props.data, () => {
  const validKeys = new Set(props.data.map((row) => row[props.rowKey]))
  selectedRows.value.forEach((key) => {
    if (!validKeys.has(key)) {
      selectedRows.value.delete(key)
    }
  })
}, { deep: true })
</script>

<template>
  <div class="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
    <!-- Loading overlay -->
    <div
      v-if="loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm"
    >
      <div class="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <div class="i-hugeicons-loading-03 w-5 h-5 animate-spin" />
        <span class="text-sm">Loading...</span>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full">
        <!-- Header -->
        <thead
          :class="[
            'bg-neutral-50 dark:bg-neutral-800/50',
            stickyHeader ? 'sticky top-0 z-10' : '',
          ]"
        >
          <tr>
            <!-- Selection checkbox column -->
            <th
              v-if="selectable"
              class="w-12 px-4 py-3"
            >
              <div class="flex items-center justify-center">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  :indeterminate="isPartiallySelected"
                  class="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-700"
                  @change="toggleSelectAll"
                />
              </div>
            </th>

            <!-- Data columns -->
            <th
              v-for="column in columns"
              :key="column.key"
              :class="[
                'px-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400',
                compact ? 'py-2' : 'py-3',
                getAlignClass(column.align),
                column.sortable ? 'cursor-pointer select-none hover:text-neutral-700 dark:hover:text-neutral-200' : '',
                column.class || '',
              ]"
              :style="column.width ? { width: column.width } : {}"
              @click="handleSort(column)"
            >
              <div class="inline-flex items-center gap-1.5">
                <span>{{ column.label }}</span>
                <!-- Sort indicator -->
                <template v-if="column.sortable">
                  <div
                    v-if="sortColumn === column.key"
                    :class="[
                      sortDirection === 'asc' ? 'i-hugeicons-arrow-up-01' : 'i-hugeicons-arrow-down-01',
                      'w-3.5 h-3.5',
                    ]"
                  />
                  <div
                    v-else
                    class="i-hugeicons-arrow-up-down-01 w-3.5 h-3.5 opacity-30"
                  />
                </template>
              </div>
            </th>

            <!-- Actions column slot -->
            <th v-if="$slots.actions" class="w-12 px-4 py-3" />
          </tr>
        </thead>

        <!-- Body -->
        <tbody :class="[striped ? 'divide-y-0' : 'divide-y divide-neutral-200 dark:divide-neutral-700']">
          <tr
            v-for="(row, index) in data"
            :key="row[rowKey]"
            :class="[
              hoverable ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50' : '',
              striped && index % 2 === 1 ? 'bg-neutral-50/50 dark:bg-neutral-800/25' : '',
              selectable && selectedRows.has(row[rowKey]) ? 'bg-blue-50/50 dark:bg-blue-900/20' : '',
              'transition-colors',
            ]"
            @click="handleRowClick(row, index)"
          >
            <!-- Selection checkbox -->
            <td
              v-if="selectable"
              class="w-12 px-4"
              :class="compact ? 'py-2' : 'py-3'"
              @click.stop
            >
              <div class="flex items-center justify-center">
                <input
                  type="checkbox"
                  :checked="selectedRows.has(row[rowKey])"
                  class="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-700"
                  @change="toggleRowSelection(row)"
                />
              </div>
            </td>

            <!-- Data cells -->
            <td
              v-for="column in columns"
              :key="column.key"
              :class="[
                'px-4 text-sm text-neutral-700 dark:text-neutral-200',
                compact ? 'py-2' : 'py-3',
                getAlignClass(column.align),
                column.class || '',
              ]"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :index="index">
                {{ row[column.key] }}
              </slot>
            </td>

            <!-- Actions cell -->
            <td
              v-if="$slots.actions"
              class="w-12 px-4"
              :class="compact ? 'py-2' : 'py-3'"
              @click.stop
            >
              <slot name="actions" :row="row" :index="index" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div
      v-if="data.length === 0 && !loading"
      class="flex flex-col items-center justify-center py-12 px-4"
    >
      <slot name="empty">
        <div class="mb-3 p-3 rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div class="i-hugeicons-inbox-01 w-6 h-6 text-neutral-400" />
        </div>
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {{ emptyTitle }}
        </p>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {{ emptyDescription }}
        </p>
      </slot>
    </div>

    <!-- Footer slot -->
    <div
      v-if="$slots.footer"
      class="border-t border-neutral-200 dark:border-neutral-700 px-4 py-3 bg-neutral-50/50 dark:bg-neutral-800/25"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
