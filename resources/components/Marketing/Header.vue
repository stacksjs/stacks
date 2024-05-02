<script setup lang="ts">
import Button from '../Button.vue'
</script>

<template>
  <header class="py-10">
    <Container>
      <nav class="relative z-50 flex justify-between">
        <div class="flex items-center md:gap-x-12">
          <router-link to="#" aria-label="Home">
            <Logo class="h-10 w-auto pb-1" />
          </router-link>

          <div class="hidden md:flex md:gap-x-6">
            <NavLink href="#features">
              Features
            </NavLink>

            <NavLink href="#testimonials">
              Testimonials
            </NavLink>

            <NavLink href="#pricing">
              Dashboard
            </NavLink>

            <NavLink href="/blog">
              Blog
            </NavLink>
          </div>
        </div>

        <div class="flex items-center gap-x-5 md:gap-x-8">
          <div class="hidden md:block">
            <NavLink href="https://github.com/stacksjs/stacks/releases">
              Changelog
            </NavLink>
          </div>

          <!-- <div class="hidden md:block">
            <NavLink href="/login">
              Sign in
            </NavLink>
          </div> -->

          <Button href="/docs" color="blue" variant="solid">
            <span>
              Learn More
              <!-- Get started <span class="hidden lg:inline">today</span> -->
            </span>
          </Button>

          <div class="-mr-1 md:hidden">
            Mobile Navigation Component
            <!-- <MobileNavigation /> -->
          </div>
        </div>
      </nav>
    </Container>
  </header>
</template>
