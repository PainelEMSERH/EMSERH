import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware({
  publicRoutes: ['/sign-in(.*)', '/sign-up(.*)', '/favicon.ico', '/images/(.*)']
})

export const config = {
  matcher: ['/((?!_next|.*\..*).*)'],
}
