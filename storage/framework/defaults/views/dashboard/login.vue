
  
<script setup lang="ts">
import Login from '../../../core/components/auth/src/components/Login.vue'

function handleLogin(email: string, password: string) {
  console.log(email, password)
}
</script>

<route lang="yaml">
meta:
layout: guest
</route>

<template>
  <div>
    <Login @submit="handleLogin" />
  </div>
</template>