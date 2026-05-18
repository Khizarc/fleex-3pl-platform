// Clerk middleware — protects the two app shells.
//
// Unauthenticated requests on /warehouse or /portal are redirected to /sign-in.
// Public routes (/, /sign-in, /sign-up, /access-pending) are left open.
// Role enforcement (staff vs client portal user) happens server-side in
// lib/auth/current-user.ts — this middleware only enforces *authentication*.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/warehouse(.*)', '/portal(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Standard Next.js + Clerk matcher: run on everything except static assets
  // and Next internals; always run on API routes.
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
