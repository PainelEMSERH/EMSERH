import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes (do NOT require auth)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) return;

  // Minimal protection without relying on deprecated helpers
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBack: true });
  }
});

// Run on all routes except static assets and _next/*
export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ],
};
