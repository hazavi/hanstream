"use client";

import { useSearchParams } from "next/navigation";
import { Watch2getherContainer } from "@/components/Watch2getherContainer";
import { Suspense } from "react";

function Watch2getherContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  return <Watch2getherContainer initialRoomId={roomId} />;
}

export default function Watch2getherPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      }
    >
      <Watch2getherContent />
    </Suspense>
  );
}
