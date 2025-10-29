// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)'
]);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return;
  auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!.*\..*|_next).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ],
};