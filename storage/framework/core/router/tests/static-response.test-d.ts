import type { StacksRouterInstance } from '../src'
import { createStacksRouter } from '../src'

type Equal<TLeft, TRight>
  = (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2) ? true : false
type Expect<T extends true> = T

const router = createStacksRouter()
const registration = router.staticResponse('GET', '/ready', new Response('ready'))

type RegistrationReturnsRouter = Expect<Equal<typeof registration, StacksRouterInstance>>

// @ts-expect-error static responses cannot attach middleware that will never run
registration.middleware('auth')

// @ts-expect-error static responses cannot be named through a bypassed route chain
registration.name('ready')

// @ts-expect-error the explicit API only accepts supported HTTP methods
router.staticResponse('TRACE', '/trace', new Response('no'))

void (null as unknown as RegistrationReturnsRouter)
