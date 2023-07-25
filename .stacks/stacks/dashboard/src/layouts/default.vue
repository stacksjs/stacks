<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
import MobileSidebar from '../components/MobileSidebar.vue'
import Navbar from '../components/Navbar.vue'
</script>

<template>
  <!--
  This example requires some changes to your config:

  ```
  // tailwind.config.js
  module.exports = {
    // ...
    plugins: [
      // ...
      require('@tailwindcss/forms'),
    ],
  }
  ```
-->
  <!--
  This example requires updating your template:

  ```
  <html class="h-full bg-white">
  <body class="h-full">
  ```
-->
  <div>
    <!-- Off-canvas menu for mobile, show/hide based on off-canvas menu state. -->
    <MobileSidebar />

    <Sidebar />

    <div class="lg:pl-72">
      <Navbar />

      <main class="bg-gray-50">
        <RouterView />
      </main>
    </div>
  </div>
</template>
