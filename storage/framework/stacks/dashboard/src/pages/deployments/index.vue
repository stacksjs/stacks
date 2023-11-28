<script lang="ts" setup>
useHead({
  title: 'Dashboard - Deployments',
})
</script>

<template>
  <!-- <div class="px-4 mb-4 sm:px-6 lg:px-8 mt-8">
    <div>
      <div class="flex items-center justify-between">
        <div class="flex items-start text-xl font-medium text-gray-900 sm:mx-none sm:mr-auto dark:text-gray-100">
          <h1 class="font-semibold text-2xl dark:text-gray-200 text-gray-700">
            stacks.dev
          </h1>
        </div>
        <div class="flex items-center">
          <AppButton passed-class="primary-button" loading-text="Deploying..." button-text="Deploy">
            <template #icon>
              <div class="i-heroicons-cloud-arrow-up w-6 h-6 mr-2" />
            </template>
          </AppButton>
        </div>
      </div>
    </div>
  </div> -->

  <DeploymentList />

  <ActivityFeed />  
</template>
