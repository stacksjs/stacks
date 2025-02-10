<script setup lang="ts">
import avatarImage1 from '../../assets/images/avatars/avatar-1.png'
import avatarImage2 from '../../assets/images/avatars/avatar-2.png'
import avatarImage3 from '../../assets/images/avatars/avatar-3.png'
import avatarImage4 from '../../assets/images/avatars/avatar-4.png'
import avatarImage5 from '../../assets/images/avatars/avatar-5.png'

const testimonials = [
  [
    {
      content:
        'Stacks is a rapid development framework that has helped me create and maintain frontends, backends, and clouds without worrying about the boilerplate.',
      author: {
        name: 'Sheryl Berge',
        role: 'CEO at Lynch LLC',
        image: avatarImage1,
      },
    },
    {
      content:
        'The Stacks mantra, "Convention over configuration", has made my development process much smoother and efficient.',
      author: {
        name: 'Amy Hahn',
        role: 'Director at Velocity Industries',
        image: avatarImage4,
      },
    },
  ],
  [
    {
      content:
        'Getting started with Stacks was incredibly easy. The Buddy toolkit has been a game changer for my project. I suggest you guys give it a try today! It\'s probably one of the best decisions you\'ll ever do for yourself this year.',
      author: {
        name: 'Leland Kiehn',
        role: 'Founder of Kiehn and Sons',
        image: avatarImage5,
      },
    },
    {
      content:
        'The Stacks framework is a harmony of several engines that has allowed me to build web and desktop applications in highly scalable and privacy-friendly ways.',
      author: {
        name: 'Erin Powlowski',
        role: 'COO at Armstrong Inc',
        image: avatarImage2,
      },
    },
  ],
  [
    {
      content:
        'Stacks has enhanced my productivity as a developer. No more creating boilerplate, and the IDE integration is fantastic.',
      author: {
        name: 'Peter Renolds',
        role: 'Founder of West Inc',
        image: avatarImage3,
      },
    },
    {
      content: 'The Stacks CI/CD has allowed me to focus on coding, not publishing. The CI/CD is superb!',
      author: {
        name: 'Amy Hahn',
        role: 'Director at Velocity Industries',
        image: avatarImage4,
      },
    },
  ],
]
</script>

<template>
  <section
    id="testimonials"
    aria-label="What our customers are saying"
    class="bg-slate-50 py-20 sm:py-32"
  >
    <Container>
      <div class="mx-auto max-w-2xl md:text-center">
        <h2 class="font-display text-3xl text-slate-900 tracking-tight sm:text-4xl">
          Enjoyed by businesses and highly recommended by devs across the globe.
        </h2>
        <p class="mt-4 text-lg text-slate-700 tracking-tight">
          The goal of the framework is to help you create & maintain frontends, backends, and clouds—without having to worry about the boilerplate. Stacks is a rapid development framework, meeting all your full stack needs.
        </p>
      </div>
      <ul
        role="list"
        class="grid grid-cols-1 mx-auto mt-16 max-w-2xl gap-6 lg:grid-cols-3 lg:mt-20 lg:max-w-none sm:gap-8"
      >
        <li v-for="(column, columnIndex) in testimonials" :key="columnIndex">
          <ul role="list" class="flex flex-col gap-y-6 sm:gap-y-8">
            <li v-for="(testimonial, testimonialIndex) in column" :key="testimonialIndex">
              <figure class="relative rounded-2xl bg-white p-6 shadow-slate-900/10 shadow-xl">
                <!-- <QuoteIcon class="absolute left-6 top-6 fill-slate-100" /> -->
                <blockquote class="relative">
                  <p class="text-lg text-slate-900 tracking-tight">
                    {{ testimonial.content }}
                  </p>
                </blockquote>
                <figcaption class="relative mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
                  <div>
                    <div class="font-display text-base text-slate-900">
                      {{ testimonial.author.name }}
                    </div>
                    <div class="mt-1 text-sm text-slate-500">
                      {{ testimonial.author.role }}
                    </div>
                  </div>
                  <div class="overflow-hidden rounded-full bg-slate-50">
                    <img
                      class="h-14 w-14 object-cover"
                      :src="testimonial.author.image"
                      alt=""
                      width="56"
                      height="56"
                    >
                  </div>
                </figcaption>
              </figure>
            </li>
          </ul>
        </li>
      </ul>
    </Container>
  </section>
</template>
