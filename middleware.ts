import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
	'/wizard(.*)',
	'/dashboard(.*)',
	'/admin(.*)',
	'/psychiatrist(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
	const { userId, redirectToSignIn } = await auth();
	if (isProtectedRoute(req) && !userId) {
		return redirectToSignIn();
	}
});

export const config = {
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};