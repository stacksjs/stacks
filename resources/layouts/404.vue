<template>
  <SlimLayout>
    <div class="flex">
      <router-link to="/" aria-label="Home">
        <Logo class="h-10 w-auto" />
      </router-link>
    </div>

    <p class="mt-20 text-sm text-gray-700 font-medium">
      404
    </p>

    <h1 class="mt-3 text-lg text-gray-900 font-semibold">
      Page not found
    </h1>

    <p class="mt-3 text-sm text-gray-700">
      Sorry, we couldn’t find the page you’re looking for.
    </p>

    <Button href="/" class="mt-10">
      Go back home
    </Button>
  </SlimLayout>
</template>
