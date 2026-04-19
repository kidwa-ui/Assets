"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { THB, fmtK, COA, netBal } from "@/lib/balance";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, summary, queueItems, userBanks, ccCards, userLiabs } = useFinance();

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

  // Build dynamic COA for individual loan/bank accounts
  const bankCOA = Object.fromEntries(userBanks.map(b => [b.account_code, { name: b.name, type: "asset" as const, normal: "debit" as const }]));
  const cardCOA = Object.fromEntries(ccCards.map(c => [c.account_code, { name: c.name, type: "liability" as const, normal: "credit" as const }]));
  const liabCOA = Object.fromEntries(userLiabs.map(l => [l.account_code, { name: l.name, type: "liability" as const, normal: "credit" as const }]));
  const dynCOA  = { ...bankCOA, ...cardCOA, ...liabCOA };
  const g = (c: string) => netBal(balances, c, dynCOA);

  const cashAccts = ["1110", "1120", "1130"];
  const cashTotal = cashAccts.reduce((s, c) => s + g(c), 0);

  // Credit cards and BNPL: sum individual cards
  const ccTotal   = ccCards.filter(c => c.card_type === "credit").reduce((s, c) => s + g(c.account_code), 0);
  const bnplTotal = ccCards.filter(c => c.card_type === "bnpl").reduce((s, c) => s + g(c.account_code), 0);

  // Loans: sum individual user_liabs if any, else fall back to parent account
  const homeLoans     = userLiabs.filter(l => l.type === "home");
  const carLoans      = userLiabs.filter(l => l.type === "car");
  const personalLoans = userLiabs.filter(l => l.type === "personal");
  const homeTotal     = homeLoans.length > 0 ? homeLoans.reduce((s, l) => s + g(l.account_code), 0) : g("2210");
  const carTotal      = carLoans.length > 0  ? carLoans.reduce((s, l) => s + g(l.account_code), 0)  : g("2220");
  const personalTotal = personalLoans.length > 0 ? personalLoans.reduce((s, l) => s + g(l.account_code), 0) : g("2230");

  const liabItems = [
    ccTotal   > 0 && { label: "บัตรเครดิต", val: ccTotal },
    bnplTotal > 0 && { label: "BNPL",        val: bnplTotal },
    homeTotal > 0 && { label: COA["2210"]?.name, val: homeTotal },
    carTotal  > 0 && { label: COA["2220"]?.name, val: carTotal },
    personalTotal > 0 && { label: COA["2230"]?.name, val: personalTotal },
  ].filter(Boolean) as { label: string; val: number }[];

  const stats = [
    { label: "สินทรัพย์รวม",     value: totalAssets,  color: "#22c55e" },
    { label: "หนี้สินรวม",        value: totalLiab,    color: "#ef4444" },
    { label: "Net Worth",         value: totalEquity,  color: "#8b5cf6" },
    { label: "กำไร/ขาดทุนงวดนี้", value: netIncome,    color: netIncome >= 0 ? "#22c55e" : "#ef4444" },
  ];

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
          ) : liabItems.map(item => (
            <div key={item.label} className="flex justify-between px-4 py-2.5 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
              <span style={{ color: "#cdd5e0" }}>{item.label}</span>
              <span style={{ color: "#ef4444" }}>{THB(item.val)}</span>
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
