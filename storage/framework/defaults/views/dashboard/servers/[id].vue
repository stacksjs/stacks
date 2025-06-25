<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute } from 'vue-router'

useHead({
  title: 'Server Details',
})

const route = useRoute()
const serverId = route.params.id as string

interface ServerConfig {
  name: string
  domain: string
  region: string
  type: string
  size: string
  diskSize: number
  privateNetwork?: string
  subnet?: string
  serverOS: string
  bunVersion?: string
  database?: string
  databaseName?: string
  searchEngine?: string
  userData?: string
}

interface UfwRule {
  id: number
  port: string
  from: string
  to: string
  protocol: 'tcp' | 'udp' | 'any'
  action: 'ALLOW' | 'DENY'
  description: string
}

const server = ref<ServerConfig>({
  name: 'app-cosmic-nebula',
  domain: 'stacksjs.org',
  region: 'us-east-1',
  type: 'app',
  size: 't3.micro',
  diskSize: 20,
  serverOS: 'ubuntu-24-lts-x86_64',
  bunVersion: 'v1.2.3',
  database: 'sqlite',
  databaseName: 'stacks',
  searchEngine: 'meilisearch'
})

const ufwRules = ref<UfwRule[]>([
  {
    id: 1,
    port: '22',
    from: '0.0.0.0',
    to: 'any',
    protocol: 'tcp',
    action: 'ALLOW',
    description: 'SSH Access'
  },
  {
    id: 2,
    port: '80',
    from: '0.0.0.0',
    to: 'any',
    protocol: 'tcp',
    action: 'ALLOW',
    description: 'HTTP Traffic'
  },
  {
    id: 3,
    port: '443',
    from: '0.0.0.0',
    to: 'any',
    protocol: 'tcp',
    action: 'ALLOW',
    description: 'HTTPS Traffic'
  }
])

const newRule = ref<Partial<UfwRule>>({
  port: '',
  from: '0.0.0.0',
  to: 'any',
  protocol: 'tcp',
  action: 'ALLOW',
  description: ''
})

const isAddingRule = ref(false)

const addRule = () => {
  if (!newRule.value.port || !newRule.value.description) return

  ufwRules.value.push({
    id: Math.max(0, ...ufwRules.value.map(r => r.id)) + 1,
    port: newRule.value.port!,
    from: newRule.value.from!,
    to: newRule.value.to!,
    protocol: newRule.value.protocol!,
    action: newRule.value.action!,
    description: newRule.value.description!
  })

  newRule.value = {
    port: '',
    from: '0.0.0.0',
    to: 'any',
    protocol: 'tcp',
    action: 'ALLOW',
    description: ''
  }
  isAddingRule.value = false
}

const removeRule = (id: number) => {
  ufwRules.value = ufwRules.value.filter(rule => rule.id !== id)
}

const commonPorts = [
  { port: '22', name: 'SSH' },
  { port: '80', name: 'HTTP' },
  { port: '443', name: 'HTTPS' },
  { port: '3306', name: 'MySQL' },
  { port: '5432', name: 'PostgreSQL' },
  { port: '6379', name: 'Redis' },
  { port: '11211', name: 'Memcached' },
  { port: '7700', name: 'Meilisearch' },
]
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div>
              <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
                {{ server.name }}
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Server details and firewall rules.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <router-link
              to="/servers"
              class="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
            >
              <div class="i-hugeicons-arrow-left w-4 h-4"></div>
              Back to Servers
            </router-link>
          </div>
        </div>
      </div>

      <!-- Server Details -->
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow mb-8">
        <div class="px-4 py-5 sm:p-6">
          <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Server Information</h4>
          <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Domain</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.domain }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Region</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.region }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.type }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Size</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.size }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Operating System</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.serverOS }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Disk Size</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.diskSize }}GB</dd>
            </div>
            <div v-if="server.bunVersion">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Bun Version</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.bunVersion }}</dd>
            </div>
            <div v-if="server.database">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Database</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.database }}</dd>
            </div>
            <div v-if="server.searchEngine">
              <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Search Engine</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ server.searchEngine }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Firewall Rules -->
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100">Firewall Rules (UFW)</h4>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage incoming and outgoing traffic to your server.
              </p>
            </div>
            <button
              @click="isAddingRule = true"
              type="button"
              class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-2.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline transition-colors duration-200"
            >
              <span class="text-lg">+</span>
              Add Rule
            </button>
          </div>

          <!-- Add Rule Form -->
          <div v-if="isAddingRule" class="mb-6 bg-gray-50 dark:bg-blue-gray-600 rounded-lg p-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div class="lg:col-span-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                <select
                  v-model="newRule.port"
                  class="block w-full h-10 text-sm border-0 rounded-md bg-white dark:bg-blue-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                >
                  <option value="" disabled>Select a port</option>
                  <option v-for="port in commonPorts" :key="port.port" :value="port.port">
                    {{ port.port }} ({{ port.name }})
                  </option>
                  <option value="custom">Custom Port</option>
                </select>
                <input
                  v-if="newRule.port === 'custom'"
                  v-model="newRule.port"
                  type="text"
                  placeholder="Enter port number"
                  class="mt-2 block w-full h-10 text-sm border-0 rounded-md bg-white dark:bg-blue-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                >
              </div>
              <div class="lg:col-span-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From IP</label>
                <input
                  v-model="newRule.from"
                  type="text"
                  placeholder="0.0.0.0"
                  class="block w-full h-10 text-sm border-0 rounded-md bg-white dark:bg-blue-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                >
              </div>
              <div class="lg:col-span-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Protocol</label>
                <select
                  v-model="newRule.protocol"
                  class="block w-full h-10 text-sm border-0 rounded-md bg-white dark:bg-blue-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="any">Any</option>
                </select>
              </div>
              <div class="lg:col-span-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
                <select
                  v-model="newRule.action"
                  class="block w-full h-10 text-sm border-0 rounded-md bg-white dark:bg-blue-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                >
                  <option value="ALLOW">Allow</option>
                  <option value="DENY">Deny</option>
                </select>
              </div>
              <div class="lg:col-span-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  v-model="newRule.description"
                  type="text"
                  placeholder="Rule description"
                  class="block w-full h-10 text-sm border-0 rounded-md bg-white dark:bg-blue-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 transition-colors duration-200"
                >
              </div>
            </div>
            <div class="mt-4 flex justify-end gap-3">
              <button
                @click="isAddingRule = false"
                type="button"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-blue-gray-600 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                @click="addRule"
                type="button"
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline transition-colors duration-200"
              >
                Add Rule
              </button>
            </div>
          </div>

          <!-- Rules Table -->
          <div class="mt-4">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead>
                  <tr>
                    <th class="px-6 py-3 bg-gray-50 dark:bg-blue-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Port</th>
                    <th class="px-6 py-3 bg-gray-50 dark:bg-blue-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">From</th>
                    <th class="px-6 py-3 bg-gray-50 dark:bg-blue-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Protocol</th>
                    <th class="px-6 py-3 bg-gray-50 dark:bg-blue-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    <th class="px-6 py-3 bg-gray-50 dark:bg-blue-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                    <th class="px-6 py-3 bg-gray-50 dark:bg-blue-gray-600 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  <tr v-for="rule in ufwRules" :key="rule.id">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{{ rule.port }}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ rule.from }}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ rule.protocol.toUpperCase() }}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="{
                          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': rule.action === 'ALLOW',
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': rule.action === 'DENY'
                        }"
                      >
                        {{ rule.action }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ rule.description }}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        @click="removeRule(rule.id)"
                        class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
