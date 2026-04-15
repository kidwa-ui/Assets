"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) setError(error.message);
      else setMsg("ส่ง email ยืนยันแล้ว กรุณาเช็ค inbox ครับ");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      else router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#07090f" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>฿</div>
          <div>
            <div className="font-semibold text-white text-base">Personal Ledger</div>
            <div className="text-xs" style={{ color: "#455672" }}>บันทึกการเงินส่วนบุคคล</div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "#060c18" }}>
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); setMsg(""); }}
                className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                style={{
                  background: mode === m ? "#2563eb" : "transparent",
                  color: mode === m ? "#fff" : "#455672",
                }}>
                {m === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#455672" }}>ชื่อ</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="ชื่อของคุณ" required style={{ textAlign: "left" }} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#455672" }}>อีเมล</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required style={{ textAlign: "left" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#455672" }}>รหัสผ่าน</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required style={{ textAlign: "left" }} />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
            {msg   && <p className="text-xs text-green-400">{msg}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-opacity"
              style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", opacity: loading ? 0.6 : 1 }}>
              {loading ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
