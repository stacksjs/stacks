<script setup lang="ts">
import { saas } from '@stacksjs/browser'

console.log(saas)
const checkedPlanType = ref('monthly')
const selectedPlan = ref('')
const paymentStore = usePaymentStore()

const loading = ref(true)

const monthlyPricing = computed(() =>
  saas.plans.flatMap(product => product.pricing).filter(price => price.interval === 'month'),
)

const yearlyPricing = computed(() =>
  saas.plans.flatMap(product => product.pricing).filter(price => price.interval === 'year'),
)

const noIntervalPricing = computed(() =>
  saas.plans.flatMap(product => product.pricing).filter(price => !price.interval),
)

const perText = computed(() => {
  if (checkedPlanType.value === 'monthly')
    return '/month'

  if (checkedPlanType.value === 'annually')
    return '/year'

  return '/lifetime'
})

const planDescription = computed(() => {
  if (selectedPlan.value === 'pro')
    return 'All Stacks features are included & being able to invite team members.'

  return 'All Stacks features are included'
})

const hobbyPrice = computed(() => {
  if (checkedPlanType.value === 'monthly') {
    const plan = monthlyPricing.value.find(monthly => monthly.key === 'stacks_hobby_monthly')

    return ((plan?.price || 3900) / 100)
  }

  if (checkedPlanType.value === 'annually') {
    const plan = yearlyPricing.value.find(monthly => monthly.key === 'stacks_hobby_yearly')

    return ((plan?.price || 37900) / 100)
  }

  const plan = noIntervalPricing.value.find(monthly => monthly.key === 'stacks_hobby_lifetime')

  return ((plan?.price || 47900) / 100)
})

const proPrice = computed(() => {
  if (checkedPlanType.value === 'monthly') {
    const plan = monthlyPricing.value.find(monthly => monthly.key === 'stacks_pro_monthly')

    return ((plan?.price || 5900) / 100)
  }

  if (checkedPlanType.value === 'annually') {
    const plan = yearlyPricing.value.find(monthly => monthly.key === 'stacks_pro_yearly')

    return ((plan?.price || 57900) / 100)
  }

  const plan = noIntervalPricing.value.find(monthly => monthly.key === 'stacks_pro_lifetime')

  return ((plan?.price || 74900) / 100)
})

const getPlanTypeKey = computed(() => {
  if (checkedPlanType.value === 'monthly' && selectedPlan.value === 'hobby')
    return 'stacks_hobby_monthly'

  if (checkedPlanType.value === 'annually' && selectedPlan.value === 'hobby')
    return 'stacks_yearly_monthly'

  if (checkedPlanType.value === 'monthly' && selectedPlan.value === 'pro')
    return 'stacks_pro_monthly'

  if (checkedPlanType.value === 'annually' && selectedPlan.value === 'pro')
    return 'stacks_pro_yearly'

  return 'stacks_hobby_monthly'
})

async function subscribePlan() {
  await paymentStore.subscribeToPlan({
    type: getPlanTypeKey.value,
    plan: selectedPlan.value,
    description: planDescription.value,
  })
}
</script>

<template>
  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <h2 class="text-lg text-gray-900 font-medium">
          Dashboard Plans
        </h2>
      </div>

      <div>
        <div class="flex justify-center">
          <fieldset aria-label="Payment frequency">
            <div class="grid grid-cols-3 gap-x-1 rounded-full p-1 text-center text-xs/5 font-semibold ring-1 ring-gray-200 ring-inset">
              <!-- Checked: "bg-blue-600 text-white", Not Checked: "text-gray-500" -->
              <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-blue-600 text-white': checkedPlanType === 'monthly' }">
                <input v-model="checkedPlanType" type="radio" name="frequency" value="monthly" class="sr-only">
                <span>Monthly</span>
              </label>

              <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-blue-600 text-white': checkedPlanType === 'annually' }">
                <input v-model="checkedPlanType" type="radio" name="frequency" value="annually" class="sr-only">
                <span>Annually</span>
              </label>

              <label class="cursor-pointer rounded-full px-2.5 py-1" :class="{ 'bg-blue-600 text-white': checkedPlanType === 'lifetime' }">
                <input v-model="checkedPlanType" type="radio" name="frequency" value="lifetime" class="sr-only">
                <span>Lifetime</span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>
    </div>

    <div class="pt-8">
      <p class="text-gray-800 font-semibold">
        Choose one of the recurring plans.
      </p>
    </div>

    <div v-if="loading">
      <div class="pt-8">
        <fieldset>
          <div class="space-y-4">
            <label
              class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none"
            >
              <input v-model="selectedPlan" type="radio" value="hobby" class="sr-only">
              <span class="flex items-center">
                <span class="flex flex-col text-sm">
                  <span class="text-gray-900 font-medium">Hobby</span>

                  <p class="pt-2 text-xs text-gray-600">
                    All Stacks features are included.
                  </p>
                </span>
              </span>
              <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                <span class="text-gray-900 font-medium">$ {{ hobbyPrice }}</span>
                <span class="ml-1 text-gray-500 sm:ml-0">{{ perText }}</span>
              </span>
              <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true" :class="{ 'border-indigo-600 border-2': selectedPlan === 'hobby', 'border ': selectedPlan !== 'hobby' }" />
            </label>

            <!-- Active: "border-indigo-600 ring-2 ring-indigo-600", Not Active: "border-gray-300" -->
            <label aria-label="pro" class="relative block cursor-pointer border rounded-lg bg-white px-6 py-4 shadow-sm sm:flex sm:justify-between focus:outline-none">
              <input v-model="selectedPlan" type="radio" value="pro" class="sr-only">
              <span class="flex items-center">
                <span class="flex flex-col text-sm">
                  <span class="text-gray-900 font-medium">Pro</span>

                  <p class="pt-2 text-xs text-gray-600">
                    All Stacks features are included & being able to invite team members.
                  </p>
                </span>
              </span>
              <span class="mt-2 flex text-sm sm:ml-4 sm:mt-0 sm:flex-col sm:text-right">
                <span class="text-gray-900 font-medium">${{ proPrice }}</span>
                <span class="ml-1 text-gray-500 sm:ml-0">{{ perText }}</span>
              </span>
              <span class="pointer-events-none absolute rounded-lg -inset-px" aria-hidden="true" :class="{ 'border-indigo-600 border-2': selectedPlan === 'pro', 'border': selectedPlan !== 'pro' }" />
            </label>
          </div>
        </fieldset>
      </div>

      <div class="flex justify-end pt-8">
        <button
          type="button"
          :disabled="!paymentStore.hasPaymentMethods"
          class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm disabled:bg-gray-600 hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
          @click="subscribePlan()"
        >
          Subscribe
        </button>
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
