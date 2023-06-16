import { defineCdn } from 'stacks/core/utils/src'

/**
 * **CDN Configuration**
 *
 * This configuration defines your Content Delivery Network. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineCdn({
  driver: 'cloudfront',

  // drivers: {
  //   cloudfront: {}
  // }
})
