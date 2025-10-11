import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
	'/wizard(.*)',
	'/dashboard(.*)',
	'/admin(.*)',
	'/psychiatrist(.*)',
	'/onboarding(.*)',
	'/create(.*)',
	'/editor(.*)',
	'/blog-editor(.*)',
]);

const isPublicRoute = createRouteMatcher([
	'/',
	'/sign-in(.*)',
	'/sign-up(.*)',
	'/stories/public(.*)',
	'/story/(.*)',
	'/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
	const { userId, redirectToSignIn } = await auth();
	
	// Allow public routes
	if (isPublicRoute(req)) {
		return NextResponse.next();
	}
	
	// Redirect to sign-in if not authenticated
	if (isProtectedRoute(req) && !userId) {
		return redirectToSignIn();
	}
	
	return NextResponse.next();
});

export const config = {
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};