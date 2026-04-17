import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  
  // 1. Fetch session from Supabase
  const { data: session, error } = await supabase
    .from('loan_sessions')
    .select('*')
    .eq('id', token)
    .single();

  // 2. Invalid or missing token
  if (error || !session) {
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

  // 3. Mark as opened if it's currently pending
  if (session.status === "pending") {
    await supabase
      .from('loan_sessions')
      .update({ status: 'opened' })
      .eq('id', token);
  }

  // 4. Check if user is signed into Clerk
  const { userId } = await auth();

  // 5. Redirect to dashboard, BUT strictly pass the sessionId along 
  // so the VideoSession component knows which row to update later!
  const dashboardUrl = `/dashboard?sessionId=${token}`;

  if (userId) {
    // Already signed in → go straight to dashboard with ID
    redirect(dashboardUrl);
  } else {
    // Not signed in → go to sign-in, then redirect to dashboard with ID
    redirect(`/sign-in?redirect_url=${encodeURIComponent(dashboardUrl)}`);
  }
}