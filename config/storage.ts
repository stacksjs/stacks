import { defineStorage } from '../.stacks/core/config/src/helpers'
import app from './app'

/**
 * **Storage Options**
 *
 * This configuration defines all of your storage options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineStorage({
  driver: 's3',
  name: app.name || 'my-custom-bucket-name',
})
