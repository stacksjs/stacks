import { route } from '@stacksjs/router'

route.get('/', () => 'user 1') // stacksjs.org/api/user
route.get('/account', () => 'user account') // stacksjs.org/api/user/account
