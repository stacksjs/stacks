<script lang="ts" setup>
import { useHealthStore } from '../../stores/health'

const healthStore = useHealthStore()
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar />
        <div class="dark:bg-gray-800 min-h-screen">
          <div class="px-4 sm:px-6 lg:px-8 py-8">
            <div class="flex items-start">
              <div class="w-full">
                <section>
                  <Overview v-if="healthStore.currentTab === 'overview'" />
                  <Uptime v-if="healthStore.currentTab === 'uptime'" />
                  <Performance v-if="healthStore.currentTab === 'performance'" />
                  <BrokenLinks v-if="healthStore.currentTab === 'broken-links'" />
                  <ApplicationHealth v-if="healthStore.currentTab === 'application-health'" />
                  <MonthlyReport v-if="healthStore.currentTab === 'monthly-reports'" />
                  <Notifications v-if="healthStore.currentTab === 'notifications'" />
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
