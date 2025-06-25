
<script setup lang="ts">
import Login from '../../../core/components/auth/src/components/Login.vue'
import { useHead } from '@vueuse/head'
import { useAuth } from '../../functions/auth'
import type { AuthUser } from '../../types/dashboard'

const router = useRouter()

useHead({
  title: 'Login - Dashboard',
})

const { login } = useAuth()

async function handleLogin(user: AuthUser) {
  try {
    await login(user)

    router.push('/')
  }
  catch (error) {
    console.error(error)
  }
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