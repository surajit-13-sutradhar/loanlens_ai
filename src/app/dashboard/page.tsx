import VideoSession from "@/components/VideoSession";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  // 1. Await the searchParams promise to unwrap it
  const resolvedParams = await searchParams;
  const sessionId = resolvedParams.sessionId;

  // 2. Check if it exists
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/50">Missing Session ID. Please use a valid onboarding link.</p>
      </div>
    );
  }

  // 3. Pass it to the client component
  return (
    <main className="min-h-screen bg-black text-white">
      <VideoSession sessionId={sessionId} />
    </main>
  );
}