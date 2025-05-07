import { Controller } from '@stacksjs/server'
/**
 * Base Controller class providing Laravel-like functionality
 */
class ComingSoonController extends Controller {
  protected index() {
    return this.success('Coming Soon')
  }
}

export default class extends ComingSoonController {
  // Your controller methods go here
}
