"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.replace(session ? "/dashboard" : "/auth");
    });
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#07090f" }}>
      <div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div>
    </div>
  );
}
