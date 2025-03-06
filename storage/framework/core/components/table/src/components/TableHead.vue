<script setup lang="ts">
// import { useTable } from '../table'

// const { table, isColumnSortable, isColumnUsedAsSort, toggleSort, indeterminate, hits, lastColumn, readableLastColumn } = await useTable()
</script>

<template>
  <thead class="bg-gray-50">
    <tr>
      <th
        scope="col"
        class="relative w-12 px-6 sm:w-16 sm:px-8"
      >
        <!-- <input type="checkbox"
          class="absolute w-4 h-4 -mt-2 text-blue-600 border-gray-300 rounded top-1/2 left-4 sm:left-6 focus:ring-blue-500"
          :checked="indeterminate || table.selectedRows?.length === hits.length" :indeterminate="indeterminate"
          @change="table.selectedRows = ($event?.target as any).checked ? hits.map((h) => h.id) : []"
        > -->
        <!-- <input
          type="checkbox"
          class="absolute w-4 h-4 -mt-2 text-blue-600 border-gray-300 rounded top-1/2 left-4 sm:left-6 focus:ring-blue-500"
          :checked="indeterminate || selectedRows?.length === hits?.length"
          :indeterminate="indeterminate"
          @change="selectedRows = []"
        > -->
      </th>

      <!-- <th v-for="(col, index) in table.columns" :key="index" scope="col"
        class="font-semibold text-left text-sm py-3.5 pr-3 pl-4 sm:pl-6 text-gray-900"
        :class="index === 0 ? `pr-3 pl-4 sm:pl-6` : `px-3`" @click="toggleSort(col)">
        the last column is oftentimes styled slightly different

        <a href="#" class="inline-flex group">
          {{ col.includes(':') ? col.split(':')[1].trim() : col }}
          <span v-if="isColumnSortable(col)" class="flex-none ml-2 rounded"
            :class="isColumnUsedAsSort(col) ? `bg-gray-200 text-gray-900 group-hover:bg-gray-300` : `text-gray-400 invisible group-hover:visible group-focus:visible`"
            @click="toggleSort(col)">
            <div v-if="table.sort?.includes('desc')" class="w-5 h-5 i-hugeicons-solid-chevron-down" />
            <div v-if="table.sort?.includes('asc')" class="w-5 h-5 i-hugeicons-solid-chevron-up" />
          </span>
        </a>
      </th> -->

      <th class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
        <a
          href="#"
          class="group inline-flex"
        >
          <!-- {{ readableLastColumn }}
          <span v-if="isColumnSortable(lastColumn[0])"
            :class="isColumnUsedAsSort(lastColumn) ? `bg-gray-200 text-gray-900 group-hover:bg-gray-300` : `text-gray-400 invisible group-hover:visible group-focus:visible`"
            @click="toggleSort(lastColumn[0])">
            <div v-if="table.sort?.includes('desc')" class="w-5 h-5 i-hugeicons-solid-chevron-down" />
            <div v-if="table.sort?.includes('asc')" class="w-5 h-5 i-hugeicons-solid-chevron-up" />
          </span> -->
        </a>
      </th>
    </tr>
  </thead>
</template>
