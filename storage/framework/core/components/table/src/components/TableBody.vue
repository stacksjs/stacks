<!-- <script setup lang="ts">
// console.log('TableBody.vue')

const { table, columnName } = await useTable(),

<template>
  <tbody class="bg-white divide-y divide-gray-200">
    <TableRow
      v-for="(hit, index) in table.results?.hits"
      :key="index"
      :index="index"
      :hit="hit"
    >
      <template #action_column="rowData">
        <slot
          name="action_column"
          :row-data="rowData.rowData"
        />
      </template>
      <template
        v-for="(col, x) in table.columns"
        :key="x"
        #[columnName(col)]="tableRowData"
      >
        <slot
          :name="columnName(col)"
          :table-row-data="tableRowData.colData"
        />
      </template>
    </TableRow>
  </tbody>
</template> -->
