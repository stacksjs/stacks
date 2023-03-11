<script setup lang="ts">
import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const router = useRouter()

const email = ref('')
const password = ref('')

const errors: any = ref(null)
const toast = useToast()

async function login() {
  errors.value = null

  try {
    await userStore.loginUser({ email: email.value, password: password.value })
    toast.success({ text: 'Welcome back!', position: 'top', duration: 3000 })

    router.push({ name: 'index' })
  }
  catch (err: any) {
    errors.value = err.data.errors

    toast.error({ text: 'Error logging in!', position: 'top', duration: 3000 })
  }
}
</script>

<template>
  <div>
    <div class="flex min-h-screen">
      <div class="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div class="w-full max-w-sm mx-auto lg:w-96">
          <div>
            <img
              class="w-auto h-12"
              src="/carefree-logo-white.png"
              alt="Your Company"
            >
            <h2 class="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-200">
              Sign in to your account
            </h2>
          </div>

          <div class="mt-8">
            <div class="mt-6">
              <div
                class="space-y-6"
              >
                <div>
                  <label
                    for="email"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200"
                  >Email address</label>
                  <div class="mt-1">
                    <input
                      id="email"
                      v-model="email"
                      name="email"
                      type="email"
                      autocomplete="email"
                      required
                      class="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:border-teal-500 focus:ring-2 focus:outline-none sm:text-sm dark:text-gray-200 dark:bg-gray-800 dark:border-gray-700"
                      @keyup.enter="login"
                    >
                  </div>
                </div>

                <div class="space-y-1">
                  <label
                    for="password"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-200"
                  >Password</label>
                  <div class="mt-1">
                    <input
                      id="password"
                      v-model="password"
                      name="password"
                      type="password"
                      autocomplete="current-password"
                      required
                      class="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:border-teal-500 focus:ring-2 focus:outline-none sm:text-sm dark:text-gray-200 dark:bg-gray-800 dark:border-gray-700"
                      @keyup.enter="login"
                    >
                  </div>
                </div>

                <div v-if="errors">
                  <span class="text-xs text-red-500">{{ errors }}</span>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      class="w-4 h-4 text-teal-600 border-gray-300 rounded "
                    >
                    <label
                      for="remember-me"
                      class="block ml-2 text-sm text-gray-900 dark:text-gray-200"
                    >Remember me</label>
                  </div>

                  <div class="text-sm">
                    <a
                      href="#"
                      class="font-medium text-teal-600 hover:text-teal-500"
                    >Forgot your password?</a>
                  </div>
                </div>

                <div>
                  <AppButton
                    button-text="Sign in"
                    loading-text="Signing in..."
                    passed-class="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    @click="login()"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="relative flex-1 hidden w-0 lg:block">
        <img
          class="absolute inset-0 object-cover w-full h-full"
          src="https://images.unsplash.com/photo-1505904267569-f02eaeb45a4c?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
          alt=""
        >
      </div>
    </div>
  </div>
</template>
