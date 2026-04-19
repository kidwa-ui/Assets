"use client";
import React, { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { THB, fmtK, COA, netBal, calcSummary } from "@/lib/balance";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer, XAxis, YAxis,
} from "recharts";

const ASSET_COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"];
const DONUT_BG     = "#0b1220";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, summary, txns, queueItems, userBanks, ccCards, userLiabs } = useFinance();

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/auth");
    });
  }, [router]);

  const pending = queueItems.filter(q => q.status === "pending").length;

  // Build COA maps — safe before early return (no side effects)
  const bankCOA = useMemo(() => Object.fromEntries(userBanks.map(b => [b.account_code, { name: b.name, type: "asset" as const, normal: "debit" as const }])), [userBanks]);
  const cardCOA = useMemo(() => Object.fromEntries(ccCards.map(c => [c.account_code, { name: c.name, type: "liability" as const, normal: "credit" as const }])), [ccCards]);
  const liabCOA = useMemo(() => Object.fromEntries(userLiabs.map(l => [l.account_code, { name: l.name, type: "liability" as const, normal: "credit" as const }])), [userLiabs]);

  // Monthly net-worth timeline
  const monthlyData = useMemo(() => {
    if (!txns.length) return [];
    const dyn = { ...bankCOA, ...cardCOA, ...liabCOA };
    const months = Array.from(new Set(txns.map(t => t.date.slice(0, 7)))).sort();
    return months.map(m => {
      const cum = txns.filter(t => t.date.slice(0, 7) <= m);
      const s = calcSummary(cum, dyn);
      const d = new Date(m + "-15");
      const label = d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
      return { label, netWorth: s.totalEquity, assets: s.totalAssets, liab: s.totalLiab };
    });
  }, [txns, bankCOA, cardCOA, liabCOA]);

  if (loading || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#07090f" }}>
        <div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div>
      </div>
    );
  }

  const { totalAssets, totalLiab, totalEquity, netIncome, balances, balanced } = summary;
  const dynCOA = { ...bankCOA, ...cardCOA, ...liabCOA };
  const g = (c: string) => netBal(balances, c, dynCOA);

  // Asset allocation
  const cashBankTotal = [
    "1110", "1120", "1130",
    ...userBanks.map(b => b.account_code),
  ].reduce((s, c) => s + g(c), 0);
  const investTotal = g("1210") + g("1220");
  const fixedTotal  = ["1310","1320","1330","1340","1350","1360"].reduce((s, c) => s + g(c), 0);
  const assetPieces = [
    { name: "เงินสด / ธนาคาร", value: cashBankTotal },
    { name: "การลงทุน",         value: investTotal   },
    { name: "สินทรัพย์ถาวร",   value: fixedTotal    },
  ].filter(p => p.value > 0);

  // Liabilities
  const ccTotal       = ccCards.filter(c => c.card_type === "credit").reduce((s, c) => s + g(c.account_code), 0);
  const bnplTotal     = ccCards.filter(c => c.card_type === "bnpl").reduce((s, c) => s + g(c.account_code), 0);
  const homeLoans     = userLiabs.filter(l => l.type === "home");
  const carLoans      = userLiabs.filter(l => l.type === "car");
  const personalLoans = userLiabs.filter(l => l.type === "personal");
  const homeTotal     = homeLoans.length     > 0 ? homeLoans.reduce((s, l)     => s + g(l.account_code), 0) : g("2210");
  const carTotal      = carLoans.length      > 0 ? carLoans.reduce((s, l)      => s + g(l.account_code), 0) : g("2220");
  const personalTotal = personalLoans.length > 0 ? personalLoans.reduce((s, l) => s + g(l.account_code), 0) : g("2230");

  const liabItems = [
    ccTotal > 0       && { label: "บัตรเครดิต",        val: ccTotal       },
    bnplTotal > 0     && { label: "BNPL",               val: bnplTotal     },
    homeTotal > 0     && { label: COA["2210"]?.name,    val: homeTotal     },
    carTotal > 0      && { label: COA["2220"]?.name,    val: carTotal      },
    personalTotal > 0 && { label: COA["2230"]?.name,    val: personalTotal },
  ].filter(Boolean) as { label: string; val: number }[];

  const stats = [
    { label: "สินทรัพย์รวม",     value: totalAssets, color: "#22c55e" },
    { label: "หนี้สินรวม",        value: totalLiab,   color: "#ef4444" },
    { label: "Net Worth",         value: totalEquity, color: "#8b5cf6" },
    { label: "กำไร/ขาดทุนงวดนี้", value: netIncome,   color: netIncome >= 0 ? "#22c55e" : "#ef4444" },
  ];

  const chartColor = totalEquity >= 0 ? "#8b5cf6" : "#ef4444";

  return (
    <AppShell netWorth={totalEquity} netIncome={netIncome} balanced={balanced} pendingCount={pending}>
      <h1 className="text-base font-medium text-white mb-4">📊 Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: DONUT_BG, border: "0.5px solid #16243a" }}>
            <div className="text-xs mb-1" style={{ color: "#455672" }}>{s.label}</div>
            <div className="font-semibold text-sm" style={{ color: s.color }}>{fmtK(s.value)}฿</div>
          </div>
        ))}
      </div>

      {/* Net worth timeline */}
      {monthlyData.length >= 2 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: DONUT_BG, border: "0.5px solid #16243a" }}>
          <div className="text-xs font-medium mb-3" style={{ color: "#60a5fa" }}>📈 Net Worth Timeline</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#455672", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#455672", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtK(v)} width={52} />
              <Tooltip
                contentStyle={{ background: "#0f1828", border: "0.5px solid #16243a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#cdd5e0" }}
                formatter={(v: number) => [THB(v), "Net Worth"]}
              />
              <Area type="monotone" dataKey="netWorth" stroke={chartColor}
                fill="url(#nwGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Donut + Liabilities */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Asset donut */}
        {assetPieces.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: DONUT_BG, border: "0.5px solid #16243a" }}>
            <div className="text-xs font-medium mb-3" style={{ color: "#22c55e" }}>🥧 สัดส่วนสินทรัพย์</div>
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={assetPieces} dataKey="value" innerRadius={32} outerRadius={50}
                    paddingAngle={3} startAngle={90} endAngle={-270}>
                    {assetPieces.map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f1828", border: "0.5px solid #16243a", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [THB(v)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 min-w-0">
                {assetPieces.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs gap-1">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block shrink-0 w-2 h-2 rounded-full" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                      <span className="truncate" style={{ color: "#cdd5e0" }}>{p.name}</span>
                    </span>
                    <span className="shrink-0 font-medium" style={{ color: ASSET_COLORS[i % ASSET_COLORS.length] }}>{fmtK(p.value)}฿</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1" style={{ borderTop: "0.5px solid #16243a" }}>
                  <span style={{ color: "#455672" }}>รวมสินทรัพย์</span>
                  <span style={{ color: "#22c55e" }} className="font-medium">{fmtK(totalAssets)}฿</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Liabilities */}
        <div className="rounded-xl overflow-hidden" style={{ background: DONUT_BG, border: "0.5px solid #16243a" }}>
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

      {/* Cash / Bank accounts */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: DONUT_BG, border: "0.5px solid #16243a" }}>
        <div className="px-4 py-2.5 text-xs font-medium text-white" style={{ background: "#14532d" }}>💵 เงินสด / ธนาคาร</div>
        {["1110","1120","1130"].map(c => g(c) > 0 ? (
          <div key={c} className="flex justify-between px-4 py-2.5 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
            <span style={{ color: "#cdd5e0" }}>{COA[c]?.name}</span>
            <span style={{ color: "#22c55e" }}>{THB(g(c))}</span>
          </div>
        ) : null)}
        {userBanks.map(b => g(b.account_code) > 0 ? (
          <div key={b.id} className="flex justify-between px-4 py-2.5 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
            <span style={{ color: "#cdd5e0" }}>🏦 {b.name}</span>
            <span style={{ color: "#22c55e" }}>{THB(g(b.account_code))}</span>
          </div>
        ) : null)}
        <div className="flex justify-between px-4 py-2.5 text-sm font-medium" style={{ borderTop: "0.5px solid #16243a", background: "#0f1828" }}>
          <span style={{ color: "#cdd5e0" }}>รวม</span>
          <span style={{ color: "#22c55e" }}>{THB(cashBankTotal)}</span>
        </div>
      </div>

      {pending > 0 && (
        <a href="/upcoming" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "#1a1000", border: "0.5px solid #f59e0b44", color: "#f59e0b" }}>
          ⚠ มีรายการผ่อนชำระรอ confirm {pending} รายการ → กดเพื่อดำเนินการ
        </a>
      )}
    </AppShell>
  );
}
