"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/server/auth-client";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
