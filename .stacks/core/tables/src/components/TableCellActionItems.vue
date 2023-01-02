<script setup lang="ts">
import { useTable } from '../functions/table'

const { actions } = await useTable()
</script>

<template>
  {{ actions }}
</template>
