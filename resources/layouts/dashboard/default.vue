
<template>
  <div>
    <!-- Off-canvas menu for mobile, show/hide based on off-canvas menu state. -->
    <MobileSidebar />
    <Sidebar />

    <div class="lg:pl-64">
      <Navbar />

      <RouterView v-slot="{ Component }">
        <main v-if="Component" class="bg-blue-gray-50 dark:bg-blue-gray-900">
          <Transition mode="out-in">
            <Suspense timeout="0">
              <Component :is="Component" />
              <template #fallback>
                Loading...
              </template>
            </Suspense>
          </Transition>
        </main>
      </RouterView>

      <Toast />
    </div>
  </div>
</template>

<style>
body {
  @apply dark:bg-blue-gray-900 bg-blue-gray-50;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.1s ease-in-out;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>