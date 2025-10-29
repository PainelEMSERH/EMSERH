/* Drop-in middleware for Clerk + Next.js (no 'protect' typings). */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) return;
  // Minimal protection without relying on 'protect' type
  const a = auth();
  if (!a.userId) {
    return a.redirectToSignIn({ returnBack: true });
  }
});

export const config = {
  // run on all routes except static assets/_next/*
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
