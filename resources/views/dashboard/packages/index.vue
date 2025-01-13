<script lang="ts" setup>
useHead({
  title: 'Dashboard - Packages',
})

const packages = [
  {
    name: 'stacks',
    version: 'v0.68.2',
    downloads: 1001897,
    issues: 12,
    contributors: 24,
    size: '5.2kb',
    path: './packages/stacks/*',
    createdAt: '2024-01-15',
    codename: 'Playa Vista',
    description: 'A modern Full Stack TypeScript framework',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'qrx',
    version: 'v1.0.0',
    downloads: 71897,
    issues: 12,
    contributors: 24,
    size: '5.2kb',
    path: './packages/qrx/*',
    createdAt: '2024-01-15',
    codename: 'Quantum',
    description: 'High-performance QR code generator and reader',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'rpx',
    version: 'v2.1.3',
    downloads: 52438,
    issues: 8,
    contributors: 16,
    size: '4.8kb',
    path: './packages/rpx/*',
    createdAt: '2024-01-20',
    codename: 'Rapid',
    description: 'Real-time pixel manipulation library',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'tlsx',
    version: 'v0.9.0',
    downloads: 23567,
    issues: 15,
    contributors: 9,
    size: '7.1kb',
    path: './packages/tlsx/*',
    createdAt: '2024-01-25',
    codename: 'Secure',
    description: 'Modern TLS/SSL toolkit for Node.js',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'dtsx',
    version: 'v1.2.0',
    downloads: 34892,
    issues: 6,
    contributors: 12,
    size: '3.9kb',
    path: './packages/dtsx/*',
    createdAt: '2024-01-30',
    codename: 'TypeMaster',
    description: 'Advanced TypeScript tooling',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'bunfig',
    version: 'v0.8.0',
    downloads: 18234,
    issues: 10,
    contributors: 7,
    size: '2.8kb',
    path: './packages/bunfig/*',
    createdAt: '2024-02-05',
    codename: 'Configure',
    description: 'Configuration management for Bun projects',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'localtunnels',
    version: 'v1.5.0',
    downloads: 45673,
    issues: 14,
    contributors: 19,
    size: '6.3kb',
    path: './packages/localtunnels/*',
    createdAt: '2024-02-10',
    codename: 'Tunnel',
    description: 'Secure local tunnel creation made easy',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'ts-collect',
    version: 'v2.0.1',
    downloads: 28945,
    issues: 9,
    contributors: 11,
    size: '4.1kb',
    path: './packages/ts-collect/*',
    createdAt: '2024-02-15',
    codename: 'Collector',
    description: 'Collection utilities for TypeScript',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'ts-spreadsheets',
    version: 'v1.3.2',
    downloads: 39567,
    issues: 11,
    contributors: 15,
    size: '8.2kb',
    path: './packages/ts-spreadsheets/*',
    createdAt: '2024-02-20',
    codename: 'Excel',
    description: 'TypeScript spreadsheet manipulation',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'bun-plugin-auto-imports',
    version: 'v0.6.0',
    downloads: 15678,
    issues: 7,
    contributors: 5,
    size: '3.4kb',
    path: './packages/bun-plugin-auto-imports/*',
    createdAt: '2024-02-25',
    codename: 'AutoImport',
    description: 'Automatic import handling for Bun',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'bun-plugin-dtsx',
    version: 'v0.5.0',
    downloads: 12345,
    issues: 5,
    contributors: 4,
    size: '2.9kb',
    path: './packages/bun-plugin-dtsx/*',
    createdAt: '2024-03-01',
    codename: 'TypePlugin',
    description: 'DTSX support for Bun',
    stars: Math.floor(Math.random() * 1000) + 100
  },
  {
    name: 'vite-plugin-local',
    version: 'v1.1.0',
    downloads: 31456,
    issues: 13,
    contributors: 8,
    size: '4.7kb',
    path: './packages/vite-plugin-local/*',
    createdAt: '2024-03-05',
    codename: 'Local',
    description: 'Local development enhancements for Vite',
    stars: Math.floor(Math.random() * 1000) + 100
  }
]

const getPackageUrl = (pkgName: string) => `https://github.com/stacksjs/${pkgName}`
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats section -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <!-- Total Downloads -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-arrow-down-tray h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Downloads
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ packages.reduce((sum, pkg) => sum + pkg.downloads, 0).toLocaleString() }}
              </p>
            </dd>
          </div>

          <!-- Total Contributors -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-users h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Contributors
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ packages.reduce((sum, pkg) => sum + pkg.contributors, 0) }}
              </p>
            </dd>
          </div>

          <!-- Total Issues -->
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-bug-ant h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total New Issues
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                {{ packages.reduce((sum, pkg) => sum + pkg.issues, 0) }}
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Packages section -->
    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Packages
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all the packages you are tracking.
          </p>
        </div>
      </div>

      <!-- Package Grid -->
      <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <a v-for="pkg in packages"
           :key="pkg.name"
           :href="getPackageUrl(pkg.name)"
           target="_blank"
           rel="noopener"
           class="group block overflow-hidden rounded-lg bg-white shadow transition-all hover:shadow-md">
          <!-- Card Header -->
          <div class="border-b border-gray-100 bg-gray-50 p-4 group-hover:bg-gray-100">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg text-gray-900 font-semibold">{{ pkg.name }}</h3>
                <p class="text-sm text-gray-500">{{ pkg.version }}</p>
                <p v-if="pkg.codename" class="text-sm text-gray-500">{{ pkg.codename }}</p>
              </div>
              <div class="i-heroicons-cube h-6 w-6 text-blue-500" />
            </div>
            <p class="mt-2 text-sm text-gray-600 truncate max-w-[310px]">{{ pkg.description }}</p>
          </div>

          <!-- Card Content -->
          <div class="p-4">
            <!-- Metrics -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <div class="i-heroicons-arrow-down-tray h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                <p class="font-semibold">{{ pkg.downloads.toLocaleString() }}</p>
              </div>

              <div class="flex items-center gap-1">
                <div class="i-heroicons-bug-ant h-4 w-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                <p class="font-semibold">{{ pkg.issues }}</p>
              </div>

              <div class="flex items-center gap-1">
                <div class="i-heroicons-users h-4 w-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                <p class="font-semibold">{{ pkg.contributors }}</p>
              </div>

              <div class="flex items-center gap-1">
                <div class="i-heroicons-star h-4 w-4 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                <p class="font-semibold">{{ pkg.stars.toLocaleString() }}</p>
              </div>
            </div>

            <!-- Details -->
            <div class="mt-4 space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">Size:</span>
                <span class="font-mono">{{ pkg.size }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">Path:</span>
                <span class="font-mono text-right truncate max-w-[240px]" :title="pkg.path">{{ pkg.path }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">Created:</span>
                <span>{{ pkg.createdAt }}</span>
              </div>
            </div>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>
