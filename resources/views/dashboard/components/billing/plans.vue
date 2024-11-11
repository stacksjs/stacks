<script setup lang="ts">
const checkedPlanType = ref('monthly')
const selectedPlan = ref('')

const perText = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return '/month'

  return '/year'
})

const hobbyPrice = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return 39

  return 379
})

const proPrice = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return 49

  return 479
})

</script>

<template>
  <div class="mx-auto px-4 py-8 container lg:px-8">
    <div id="unsubscribed" class="flex justify-center">
      <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <div class="flex items-center space-x-2">
          <img
            src="/images/logos/logo.svg"
            alt=""
            class="h-12 w-12 rounded-md"
          >
          <h2 class="text-lg text-gray-900 font-medium">
            Stacks Dashboard Plans
          </h2>
        </div>

        <div class="pt-8">
          <p class="text-gray-800 font-semibold">
            Choose the plans that suite your needs.
          </p>
        </div>

        <div class="pt-8">
          <div class="mt-16 flex justify-center">
            <fieldset aria-label="Payment frequency">
              <div class="grid grid-cols-2 gap-x-1 rounded-full p-1 text-center text-xs/5 font-semibold ring-1 ring-gray-200 ring-inset">
                <!-- Checked: "bg-indigo-600 text-white", Not Checked: "text-gray-500" -->
                <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-indigo-600 text-white': checkedPlanType === 'monthly' }">
                  <input v-model="checkedPlanType" type="radio" name="frequency" value="monthly" class="sr-only">
                  <span>Monthly</span>
                </label>
                <!-- Checked: "bg-indigo-600 text-white", Not Checked: "text-gray-500" -->
                <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-indigo-600 text-white': checkedPlanType === 'annually' }">
                  <input v-model="checkedPlanType" type="radio" name="frequency" value="annually" class="sr-only">
                  <span>Annually</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>

        <div class="pt-8">
          <fieldset aria-label="Server size">
            <div class="space-y-4">
              <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
              <label aria-label="Hobby" aria-description="8GB, 4 CPUs, 160 GB SSD disk, $40 per month" class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none">
                <input v-model="selectedPlan" type="radio" name="server-size" value="Hobby" class="sr-only">
                <span class="flex items-center">
                  <span class="flex flex-col text-sm">
                    <span class="text-gray-900 font-medium">Hobby</span>

                  </span>
                </span>
                <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                  <span class="text-gray-900 font-medium">${{ hobbyPrice }}</span>
                  <span class="ml-1 text-gray-500 sm:ml-0">{{ perText }}</span>
                </span>
                <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true" :class="{'border-indigo-600 border-2': selectedPlan === 'Hobby', 'border ': selectedPlan !== 'Hobby' }" />
              </label>
              <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
              <label aria-label="Pro" aria-description="12GB, 6 CPUs, 256 GB SSD disk, $80 per month" class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none">
                <input v-model="selectedPlan" type="radio" name="server-size" value="Pro" class="sr-only">
                <span class="flex items-center">
                  <span class="flex flex-col text-sm">
                    <span class="text-gray-900 font-medium">Pro</span>
                  </span>
                </span>
                <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                  <span class="text-gray-900 font-medium">${{ proPrice }}</span>
                  <span class="ml-1 text-gray-500 sm:ml-0">{{ perText }}</span>
                </span>
                <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true"  :class="{'border-indigo-600 border-2': selectedPlan === 'Pro', 'border': selectedPlan !== 'Pro' }" />
              </label>
              <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
              <label aria-label="Lifetime" aria-description="16GB, 8 CPUs, 512 GB SSD disk, $160 per month" class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none">
                <input v-model="selectedPlan" type="radio" name="server-size" value="Lifetime" class="sr-only">
                <span class="flex items-center">
                  <span class="flex flex-col text-sm">
                    <span class="text-gray-900 font-medium">Lifetime</span>
                  </span>
                </span>
                <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                  <span class="text-gray-900 font-medium">$749</span>
                  <span class="ml-1 text-gray-500 sm:ml-0">/once</span>
                </span>
              <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true"  :class="{'border-indigo-600 border-2': selectedPlan === 'Lifetime', 'border ': selectedPlan !== 'Lifetime' }" />
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
#payment-message {
  color: rgb(105, 115, 134);
  font-size: 16px;
  line-height: 20px;
  padding-top: 12px;
  text-align: center;
}

#payment-element {
  margin-bottom: 24px;
}

#payment-form {
  width: 30vw;
  min-width: 500px;
  align-self: center;
  border-radius: 7px;
  padding: 40px;
}
</style>
