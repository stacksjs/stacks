<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['submit'])

defineProps({
  showLogo: {
    type: Boolean,
    default: true
  },
  headingText: {
    type: String,
    default: 'Sign in to your account'
  },
  showSocialLogin: {
    type: Boolean,
    default: true
  },
  showRememberMe: {
    type: Boolean,
    default: true
  },
  showForgotPassword: {
    type: Boolean,
    default: true
  },
  showSignup: {
    type: Boolean,
    default: true
  },
  signupText: {
    type: String,
    default: 'Start a 14 day free trial'
  }
})

// Reactive state for form inputs and messages
const email = ref('')
const password = ref('')

// Method to emit submit event with email and password
function submitLogin() {
  emit('submit', { email: email.value, password: password.value })

  setTimeout(() => {
    password.value = ''
  }, 1000)
}
</script>

<template>
  <div class="min-h-full flex flex-col justify-center py-12 lg:px-8 sm:px-6 dark:bg-blue-gray-900">
    <div class="sm:mx-auto sm:max-w-md sm:w-full">
      <Logo v-if="showLogo" class="mx-auto h-11 w-auto" />
      <h2 class="mt-6 text-center text-2xl text-gray-900 dark:text-gray-100 font-bold leading-9 tracking-tight">
        {{ headingText }}
      </h2>
    </div>

    <form @submit.prevent="submitLogin">
    <div class="mt-10 sm:mx-auto sm:max-w-[480px] sm:w-full">
      <div class="bg-white dark:bg-blue-gray-800 px-6 py-12 shadow sm:rounded-lg sm:px-12">
        <div class="space-y-6">
          <div>
            <label for="email" class="block text-sm text-gray-900 dark:text-gray-100 font-medium leading-6">Email address</label>
            <div class="mt-2">
              <input id="email" v-model="email" name="email" type="email" autocomplete="email" required class="block w-full border-0 rounded-md py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 ring-inset sm:text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-blue-gray-700">
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm text-gray-900 dark:text-gray-100 font-medium leading-6">Password</label>
            <div class="mt-2">
              <input id="password" v-model="password" name="password" type="password" autocomplete="current-password" required class="block w-full border-0 rounded-md py-1.5 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 ring-inset sm:text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 sm:leading-6 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-blue-gray-700">
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div v-if="showRememberMe" class="flex items-center">
              <input id="remember-me" name="remember-me" type="checkbox" class="h-4 w-4 border-gray-300 dark:border-gray-600 rounded text-indigo-600 focus:ring-indigo-600 dark:bg-blue-gray-700">
              <label for="remember-me" class="ml-3 block text-sm text-gray-900 dark:text-gray-100 leading-6">Remember me</label>
            </div>

            <div v-if="showForgotPassword" class="text-sm leading-6">
              <a href="#" class="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 dark:hover:text-indigo-300">Forgot password?</a>
            </div>
          </div>

          <div>
            <button type="submit" class="w-full flex justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white font-semibold leading-6 shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline" @click="submitLogin">
              Sign in
            </button>
          </div>
        </div>

        <div v-if="showSocialLogin">
          <div class="relative mt-10">
            <div class="absolute inset-0 flex items-center" aria-hidden="true">
              <div class="w-full border-t border-gray-200 dark:border-gray-600" />
            </div>
            <div class="relative flex justify-center text-sm font-medium leading-6">
              <span class="bg-white dark:bg-blue-gray-800 px-6 text-gray-900 dark:text-gray-100">Or continue with</span>
            </div>
          </div>

          <div class="grid grid-cols-2 mt-6 gap-4">
            <a href="#" class="w-full flex items-center justify-center gap-3 rounded-md bg-white dark:bg-blue-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-semibold shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 ring-inset hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus-visible:ring-transparent">
              <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
              </svg>
              <span class="text-sm font-semibold leading-6">Google</span>
            </a>

            <a href="#" class="w-full flex items-center justify-center gap-3 rounded-md bg-white dark:bg-blue-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-semibold shadow-sm ring-1 ring-gray-300 dark:ring-gray-600 ring-inset hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus-visible:ring-transparent">
              <svg class="h-5 w-5 fill-[#24292F]" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm font-semibold leading-6">GitHub</span>
            </a>
          </div>
        </div>
      </div>

      <p v-if="showSignup" class="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
        Not a member?
        <a href="#" class="text-indigo-600 dark:text-indigo-400 font-semibold leading-6 hover:text-indigo-500 dark:hover:text-indigo-300">Start a 14 day free trial</a>
        </p>
      </div>
    </form>
  </div>
</template>
