import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSession, updateSessionStatus } from "@/lib/sessionStore";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = getSession(token);

  // Invalid token
  if (!session) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-4xl">❌</p>
          <h1 className="text-xl font-semibold">Invalid or expired link</h1>
          <p className="text-white/40 text-sm">
            This link is not valid. Please contact your loan officer.
          </p>
        </div>
      </main>
    );
  }

  // Mark as opened
  if (session.status === "pending") {
    updateSessionStatus(token, "opened");
  }

  // Check if user is signed into Clerk
  const { userId } = await auth();

  if (userId) {
    // Already signed in → go straight to dashboard
    redirect("/dashboard");
  } else {
    // Not signed in → go to sign-in, then redirect to dashboard after
    redirect(`/sign-in?redirect_url=/dashboard`);
  }
}