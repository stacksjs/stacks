<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
import MobileSidebar from '../components/MobileSidebar.vue'
import Navbar from '../components/Navbar.vue'
</script>

<template>
  <div>
    <!-- Off-canvas menu for mobile, show/hide based on off-canvas menu state. -->
    <MobileSidebar />

    <Sidebar />

    <div class="lg:pl-72">
      <Navbar />

      <main
        class="bg-gray-50 dark:bg-gray-900"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style>
body {
  @apply dark:bg-gray-900 bg-gray-50;
}
</style>
