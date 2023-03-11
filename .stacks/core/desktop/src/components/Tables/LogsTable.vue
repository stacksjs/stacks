<script lang="ts" setup>

</script>

<template>
  <TableList>
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 dark:text-gray-400 uppercase"
          >
            Model
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 dark:text-gray-400 uppercase"
          >
            Type
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 dark:text-gray-400 uppercase"
          >
            Activity
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 dark:text-gray-400 uppercase"
          >
            Timestamps
          </th>
          <th
            scope="col"
            class="relative px-6 py-3"
          >
            <span class="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- Odd row -->
        <tr>
          <td class="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap dark:text-gray-100">
            name
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            type
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-wrap">
            activity
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            created at
          </td>
          <td class="px-6 py-4 text-sm font-medium text-right whitespace-nowrap" />
        </tr>
      </tbody>
    </table>
    <!-- <EmptyTableState v-if="logs.length == 0" /> -->
  </TableList>
</template>
