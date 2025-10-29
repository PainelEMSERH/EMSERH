import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes that do NOT require auth
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return;
  auth().protect();
});

// Required so middleware runs on all routes except static assets and _next/*
export const config = {
  matcher: [
    '/((?!.+\.[\w]+$|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
