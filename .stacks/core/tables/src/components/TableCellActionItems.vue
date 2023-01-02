<script setup lang="ts">
import { useTable } from '~/composables/table'

const { actions } = await useTable()
</script>

<template>
  {{ actions }}
</template>
