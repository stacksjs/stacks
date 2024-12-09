<script lang="ts" setup>
import Item from './Item.vue'
</script>

<template>
  <Item v-for="n in 6" :data-value="`Project ${n}`">
    {{ `Project ${n}` }}
  </Item>
</template>
