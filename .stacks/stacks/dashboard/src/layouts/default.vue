<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
import MobileSidebar from '../components/MobileSidebar.vue'
import Navbar from '../components/Navbar.vue'
import Toast from '../components/Modals/Popups/Toast.vue'
</script>

<template>
  <div>
    <!-- Off-canvas menu for mobile, show/hide based on off-canvas menu state. -->
    <MobileSidebar />

    <Sidebar />

    <div class="lg:pl-72">
      <Navbar />

      <main
        class="bg-blue-gray-50 dark:bg-blue-gray-900"
      >
        <RouterView />
      </main>

      <Toast />
    </div>
  </div>
</template>

<style>
body {
  @apply dark:bg-blue-gray-900 bg-blue-gray-50;
}
</style>
