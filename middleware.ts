import { authMiddleware } from '@clerk/nextjs'
export default authMiddleware({
  publicRoutes: ['/sign-in(.*)', '/sign-up(.*)', '/favicon.ico', '/images/(.*)']
})
export const config = { matcher: ['/((?!_next|.*\..*).*)'] }