<script setup lang="ts">
import avatarImage1 from '../../assets/images/avatars/avatar-1.png'
import avatarImage2 from '../../assets/images/avatars/avatar-2.png'
import avatarImage3 from '../../assets/images/avatars/avatar-3.png'
import avatarImage4 from '../../assets/images/avatars/avatar-4.png'
import avatarImage5 from '../../assets/images/avatars/avatar-5.png'

const testimonials = [
  [
    {
      content: 'TaxPal is so easy to use I can’t help but wonder if it’s really doing the things the government expects me to do.',
      author: {
        name: 'Sheryl Berge',
        role: 'CEO at Lynch LLC',
        image: avatarImage1,
      },
    },
    {
      content: 'I’m trying to get a hold of someone in support, I’m in a lot of trouble right now and they are saying it has something to do with my books. Please get back to me right away.',
      author: {
        name: 'Amy Hahn',
        role: 'Director at Velocity Industries',
        image: avatarImage4,
      },
    },
  ],
  [
    {
      content: 'The best part about TaxPal is every time I pay my employees, my bank balance doesn’t go down like it used to. Looking forward to spending this extra cash when I figure out why my card is being declined.',
      author: {
        name: 'Leland Kiehn',
        role: 'Founder of Kiehn and Sons',
        image: avatarImage5,
      },
    },
    {
      content: 'There are so many things I had to do with my old software that I just don’t do at all with TaxPal. Suspicious but I can’t say I don’t love it.',
      author: {
        name: 'Erin Powlowski',
        role: 'COO at Armstrong Inc',
        image: avatarImage2,
      },
    },
  ],
  [
    {
      content: 'I used to have to remit tax to the EU and with TaxPal I somehow don’t have to do that anymore. Nervous to travel there now though.',
      author: {
        name: 'Peter Renolds',
        role: 'Founder of West Inc',
        image: avatarImage3,
      },
    },
    {
      content: 'This is the fourth email I’ve sent to your support team. I am literally being held in jail for tax fraud. Please answer your damn emails, this is important.',
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
        <h2 class="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">
          Loved by businesses worldwide.
        </h2>
        <p class="mt-4 text-lg tracking-tight text-slate-700">
          Our software is so simple that people can’t help but fall in love
          with it. Simplicity is easy when you just skip tons of
          mission-critical features.
        </p>
      </div>
      <ul
        role="list"
        class="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:gap-8 lg:mt-20 lg:max-w-none lg:grid-cols-3"
      >
        <li v-for="(column, columnIndex) in testimonials" :key="columnIndex">
          <ul role="list" class="flex flex-col gap-y-6 sm:gap-y-8">
            <li v-for="(testimonial, testimonialIndex) in column" :key="testimonialIndex">
              <figure class="relative rounded-2xl bg-white p-6 shadow-xl shadow-slate-900/10">
                <QuoteIcon class="absolute left-6 top-6 fill-slate-100" />
                <blockquote class="relative">
                  <p class="text-lg tracking-tight text-slate-900">
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
