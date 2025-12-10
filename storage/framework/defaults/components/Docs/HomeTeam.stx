<script setup lang="ts">
import { coreTeamMembers } from '../../../docs/contributors'
</script>

<template>
  <div class="vp-doc">
    <h2 pb-2 pt-5 font-normal op50>
      Meet The Team
    </h2>
  </div>

  <div grid="~ sm:cols-2 md:cols-3 lg:cols-4 gap-x-3 gap-y-20 items-start" p-10>
    <TeamMember
      v-for="c of coreTeamMembers"
      :key="c.github"
      :data="c"
    />
  </div>
</template>
