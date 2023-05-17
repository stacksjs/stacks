<!-- <script setup lang="ts">
import { Table as TableV2 } from './main'

const filterValues = {
  website_access: [{
    label: 'Yes',
    value: 1,
  }, {
    label: 'No',
    value: 0,
  }],
  disposition: [{
    label: 'Active',
    value: 'Active',
  }, {
    label: 'Released',
    value: 'Released',
  },
  {
    label: 'Terminated',
    value: 'Terminated',
  }],
}

  < template >
  <div class="font-sans" >
    <Suspense>
    <TableSearch />
    < /Suspense>

    < Suspense >
    <TableFilters : filter - values="filterValues" />
      </Suspense>
      < Suspense >
      <TableV2
        source="http://127.0.0.1:7700/"
password = ""
type = "users"
columns = "
id: ID,
  first_name: First Name,
    last_name: Last Name,
      npn: NPN,
        email: Email,
          website_access: Website Access,
            disposition: Disposition"
sort = "id:desc"
sorts = "id, email, npn"
filters = ""
actions = "Info"
per - page="50"
selectable = "true"
  >
  <template #id="id" >
    <a
            href="#"
class="flex font-medium text-yellow-600"
  >
  {{ id.
</script>value }}
          </a>
        </template>

        <template #customer_name="customerName">
          <a
            href="#"
            class="flex font-medium text-yellow-600"
          >
            {{ customerName.value }}
          </a>
        </template>
<template #part_name="parts">
  <a v-for="(part, index) in parts.value" :key="index" href="#" class="flex font-medium text-yellow-600">
    {{ part }}
  </a>
</template>
      </TableV2>
    </Suspense>

<Suspense>
      <TablePagination />
    </Suspense>
  </div>
</template> -->
