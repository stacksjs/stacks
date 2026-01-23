import { Controller } from '@stacksjs/server'
/**
 * Base Controller class providing Laravel-like functionality
 */
export default class ComingSoonController extends Controller {
  protected index() {
    return this.success('Coming Soon v2')
  }
}
