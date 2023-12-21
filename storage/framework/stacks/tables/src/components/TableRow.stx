<script setup lang="ts">
// import type { Hit } from '@stacksjs/types'

// const { hit, index } = defineProps<{ hit: Hit; index: number }>()

// const { table, columnName } = await useTable()

// let's generate the value of the row
// function generateValue(hit: any, col: any) {
//   if (col.includes(':'))
//     return hit[col.split(':')[0].trim()]

//   return JSON.parse(hit[col])
// }

// function getClass(index: number) {
//   if (index % 2 !== 0)
//     return 'bg-gray-200'

//   return 'bg-gray-50'
// }
</script>

<template>
  <div />
  <!-- <tr
    scope="row"
    :class="getClass(index)"
    :data-index="index"
  >
    <td class="relative w-12 px-6 sm:px-8 sm:w-16">
      <div
        v-if="table.selectedRows?.includes(hit.id)"
        class="bg-blue-600 inset-y-0 left-0 w-0.5 absolute"
      />
      <input
        v-model="table.selectedRows"
        :value="hit.id"
        type="checkbox"
        class="absolute w-4 h-4 -mt-2 text-blue-600 border-gray-300 rounded top-1/2 left-4 sm:left-6 focus:ring-blue-500"
      >
    </td>

    <td
      v-for="(col, x) in table.columns"
      :key="x"
      class="py-4 text-sm font-medium text-gray-900 whitespace-nowrap "
      :class="table.columns.length === x - 1 ? 'table-last-column pr-4 text-right sm:pr-6' : 'pr-3 pl-4 sm:pl-6'"
    >
     last columns oftentimes are styled slightly different
  <span v-if="(table.columns.length === x + 1) && (table.actionable || table.actions)">
        <slot name="action_column" :row-data="hit">
          <TableCellActionItems />
        </slot>
      </span>

  <span>
    <slot :name="columnName(col)" :col-data="generateValue(hit, col)">
      {{ generateValue(hit, col) }}
    </slot>
  </span>
  </td>

  <td v-if="(table.actionable || table.actions)">
    last columns oftentimes are styled slightly different
    <span>
      <slot name="action_column" :row-data="hit">
        <TableCellActionItems />
      </slot>
    </span>
  </td>
  </tr> -->
</template>
