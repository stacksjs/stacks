<script setup lang="ts">
import TableV2 from '../../../core/components/table/src/components/MainTable.vue'
</script>

<template>
  <Suspense>
    <TableV2 columns="id, name, email, job_title" type="users" />
  </Suspense>
</template>
