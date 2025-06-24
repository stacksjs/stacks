
<script setup lang="ts">
import Login from '../../../core/components/auth/src/components/Login.vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Login - Dashboard',
})

function handleLogin(email: string, password: string) {
  console.log(email, password)
}
</script>

<template>
  <div>
    <Login @submit="handleLogin" />
  </div>
</template>

<route lang="yaml">
  meta:
    layout: guest
    requiresAuth: false
</route>