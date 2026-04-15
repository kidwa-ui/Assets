"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { THB, fmtK, COA, netBal } from "@/lib/balance";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, summary, queueItems } = useFinance();

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/auth");
    });
  }, [router]);

  const pending = queueItems.filter(q => q.status === "pending").length;

  if (loading || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07090f" }}>
        <div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div>
      </div>
    );
  }

  const { totalAssets, totalLiab, totalEquity, netIncome, balances, balanced } = summary;
  const g = (c: string) => netBal(balances, c);

  const stats = [
    { label: "สินทรัพย์รวม",     value: totalAssets,  color: "#22c55e" },
    { label: "หนี้สินรวม",        value: totalLiab,    color: "#ef4444" },
    { label: "Net Worth",         value: totalEquity,  color: "#8b5cf6" },
    { label: "กำไร/ขาดทุนงวดนี้", value: netIncome,    color: netIncome >= 0 ? "#22c55e" : "#ef4444" },
  ];

  const cashAccts = ["1110", "1120", "1130"];
  const cashTotal = cashAccts.reduce((s, c) => s + g(c), 0);

  const liabItems = [
    ["2110", "บัตรเครดิต"],
    ["2120", "BNPL"],
    ["2210", "สินเชื่อบ้าน"],
    ["2220", "สินเชื่อรถ"],
    ["2230", "เงินกู้"],
  ].filter(([c]) => g(c) > 0);

  return (
    <AppShell netWorth={totalEquity} netIncome={netIncome} balanced={balanced} pendingCount={pending}>
      <h1 className="text-base font-medium text-white mb-4">📊 Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
            <div className="text-xs mb-1" style={{ color: "#455672" }}>{s.label}</div>
            <div className="font-semibold text-sm" style={{ color: s.color }}>{fmtK(s.value)}฿</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* เงินสด/ธนาคาร */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
          <div className="px-4 py-2.5 text-xs font-medium text-white" style={{ background: "#14532d" }}>💵 เงินสด / ธนาคาร</div>
          {cashAccts.map(c => g(c) ? (
            <div key={c} className="flex justify-between px-4 py-2.5 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
              <span style={{ color: "#cdd5e0" }}>{COA[c]?.name}</span>
              <span style={{ color: "#22c55e" }}>{THB(g(c))}</span>
            </div>
          ) : null)}
          <div className="flex justify-between px-4 py-2.5 text-sm font-medium" style={{ borderTop: "0.5px solid #16243a", background: "#0f1828" }}>
            <span style={{ color: "#cdd5e0" }}>รวม</span>
            <span style={{ color: "#22c55e" }}>{THB(cashTotal)}</span>
          </div>
        </div>

        {/* หนี้สิน */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
          <div className="px-4 py-2.5 text-xs font-medium text-white" style={{ background: "#7f1d1d" }}>💸 หนี้สินคงเหลือ</div>
          {liabItems.length === 0 ? (
            <div className="px-4 py-3 text-sm" style={{ color: "#455672" }}>ไม่มีหนี้สิน 🎉</div>
          ) : liabItems.map(([c, n]) => (
            <div key={c} className="flex justify-between px-4 py-2.5 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
              <span style={{ color: "#cdd5e0" }}>{n}</span>
              <span style={{ color: "#ef4444" }}>{THB(g(c))}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2.5 text-sm font-medium" style={{ borderTop: "0.5px solid #16243a", background: "#0f1828" }}>
            <span style={{ color: "#cdd5e0" }}>รวม</span>
            <span style={{ color: "#ef4444" }}>{THB(totalLiab)}</span>
          </div>
        </div>
      </div>

      {pending > 0 && (
        <a href="/upcoming" className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "#1a1000", border: "0.5px solid #f59e0b44", color: "#f59e0b" }}>
          ⚠ มีรายการผ่อนชำระรอ confirm {pending} รายการ → กดเพื่อดำเนินการ
        </a>
      )}
    </AppShell>
  );
}
