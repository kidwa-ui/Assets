"use client";
import { useState, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { COA, netBal, THB, calcSummary } from "@/lib/balance";

// Income group definitions. Every income account is placed in exactly one named group;
// any income code NOT listed here is swept into "รายได้อื่นๆ" automatically, so a new
// account can never silently vanish from the breakdown while still counting in the total.
const INC_GROUP_DEFS = [
  { label: "รายได้จากการทำงาน",  codes: ["4100", "4150", "4200"] },
  { label: "รายได้จากทรัพย์สิน", codes: ["4300", "4430"] },
  { label: "รายได้จากการลงทุน",  codes: ["4410", "4420", "4450"] },
  { label: "รายได้อื่นๆ",        codes: ["4440", "4490"] },
];
const INC_OTHER_LABEL = "รายได้อื่นๆ";

// Expense buckets classified by code range — derived from the COA so new codes never drop off.
const isFixedExp = (c: string) => { const n = Number(c); return n >= 5500 && n < 5600; }; // ดอกเบี้ย / ค่าธรรมเนียม / ค่าเสื่อมราคา
const isTaxExp   = (c: string) => { const n = Number(c); return n >= 5030 && n <= 5039; }; // ภาษี & ค่าธรรมเนียมภาครัฐ

const EPS = 0.005;

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${(y + 543) % 100}`;
};

export default function PLPage() {
  const { summary, txns, loading } = useFinance();
  const [expCollapsed, setExpCollapsed] = useState(true);
  const [taxCollapsed, setTaxCollapsed] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all"); // "all" | "YYYY-MM"

  const months = useMemo(() => {
    const set = new Set<string>();
    txns.forEach(t => { if (t.date) set.add(t.date.slice(0, 7)); });
    return Array.from(set).sort();
  }, [txns]);

  const view = useMemo(() => {
    if (selectedMonth === "all" || !summary) return summary;
    const filtered = txns.filter(t => t.date.slice(0, 7) === selectedMonth);
    return calcSummary(filtered);
  }, [selectedMonth, txns, summary]);

  if (loading || !summary || !view) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const { balances, totalInc, totalExp, netIncome } = view;
  const { totalEquity, balanced } = summary;
  const g = (c: string) => netBal(balances, c);
  const active = (c: string) => Math.abs(g(c)) > EPS;
  const acctName = (c: string) => COA[c]?.name ?? c;

  // ── INCOME — exhaustive: named groups + sweep of any other income code ──
  const incCodes = Array.from(new Set([
    ...Object.keys(COA).filter(c => COA[c].type === "income"),
    ...Object.keys(balances).filter(c => /^4/.test(c)),
  ]));
  const incCovered = new Set(INC_GROUP_DEFS.flatMap(gr => gr.codes));
  const incExtra = incCodes.filter(c => !incCovered.has(c)).sort();
  const incGroups = INC_GROUP_DEFS.map(gr =>
    gr.label === INC_OTHER_LABEL ? { ...gr, codes: [...gr.codes, ...incExtra] } : gr
  );

  // ── EXPENSE — exhaustive: general bucket + tax bucket + fixed financial rows ──
  const expCodes = Array.from(new Set([
    ...Object.keys(COA).filter(c => COA[c].type === "expense"),
    ...Object.keys(balances).filter(c => /^5/.test(c)),
  ]));
  const generalCodes = expCodes.filter(c => !isFixedExp(c) && !isTaxExp(c)).sort();
  const taxCodes     = expCodes.filter(isTaxExp).sort();
  const fixedCodes   = expCodes.filter(isFixedExp).sort();

  const genTotal = generalCodes.reduce((s, c) => s + g(c), 0);
  const taxTotal = taxCodes.reduce((s, c) => s + g(c), 0);
  const activeGeneral = generalCodes.filter(active);
  const activeTax     = taxCodes.filter(active);
  const activeFixed   = fixedCodes.filter(active);

  const periodLabel = selectedMonth === "all" ? "สะสมทั้งหมด" : fmtMonth(selectedMonth);

  return (
    <AppShell netWorth={totalEquity} netIncome={summary.netIncome} balanced={balanced}>
      <h1 className="text-base font-medium text-white mb-3">📈 P&L / งบกำไรขาดทุน</h1>

      {/* Period filter */}
      <div className="rounded-xl p-3 mb-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium" style={{ color: "#455672" }}>📅 ช่วงเวลา:</span>
          <span className="text-xs" style={{ color: "#93c5fd" }}>{periodLabel}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedMonth("all")}
            className="px-2.5 py-1 text-xs rounded-md font-medium"
            style={{
              background: selectedMonth === "all" ? "#1e3a8a" : "#0f1828",
              color: selectedMonth === "all" ? "#fff" : "#93a4be",
              border: "0.5px solid " + (selectedMonth === "all" ? "#1e3a8a" : "#16243a"),
            }}
          >สะสมทั้งหมด</button>
          {months.map(ym => {
            const isActive = selectedMonth === ym;
            return (
              <button
                key={ym}
                onClick={() => setSelectedMonth(ym)}
                className="px-2.5 py-1 text-xs rounded-md font-medium"
                style={{
                  background: isActive ? "#1e3a8a" : "#0f1828",
                  color: isActive ? "#fff" : "#93a4be",
                  border: "0.5px solid " + (isActive ? "#1e3a8a" : "#16243a"),
                }}
              >{fmtMonth(ym)}</button>
            );
          })}
          {months.length === 0 && (
            <span className="text-xs" style={{ color: "#455672" }}>ยังไม่มีรายการ</span>
          )}
        </div>
      </div>

      {/* Income */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <div className="px-4 py-2 text-xs font-medium text-white" style={{ background: "#1e3a8a" }}>INCOME</div>
        {incGroups.map(gr => {
          const rows = gr.codes.filter(active);
          if (!rows.length) return null;
          return (
            <div key={gr.label}>
              <div className="px-4 py-1.5 text-xs font-medium" style={{ background: "#0f1828", borderTop: "0.5px solid #16243a", color: "#455672" }}>{gr.label}</div>
              {rows.map(c => (
                <div key={c} className="flex justify-between px-6 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                  <span style={{ color: "#cdd5e0" }}>{acctName(c)}</span>
                  <span style={{ color: "#22c55e" }}>{THB(g(c))}</span>
                </div>
              ))}
            </div>
          );
        })}
        {totalInc === 0 && <div className="px-4 py-3 text-sm" style={{ color: "#455672", borderTop: "0.5px solid #16243a" }}>ยังไม่มีรายได้</div>}
        <div className="flex justify-between px-4 py-2.5 text-sm font-semibold" style={{ borderTop: "1px solid #1e3050", background: "#0f1828", color: "#22c55e" }}>
          <span>รวมรายได้</span><span>{THB(totalInc)}</span>
        </div>
      </div>

      {/* Expenses */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <div className="px-4 py-2 text-xs font-medium text-white" style={{ background: "#7f1d1d" }}>EXPENSES</div>

        {totalExp === 0
          ? <div className="px-4 py-3 text-sm" style={{ color: "#455672", borderTop: "0.5px solid #16243a" }}>ยังไม่มีค่าใช้จ่าย</div>
          : <>
            {/* ค่าใช้จ่ายทั่วไป group — collapsible */}
            {Math.abs(genTotal) > EPS && (
              <>
                <button
                  onClick={() => setExpCollapsed(p => !p)}
                  className="w-full flex justify-between items-center px-4 py-1.5 text-xs font-medium text-left"
                  style={{ background: "#0f1828", borderTop: "0.5px solid #16243a", color: "#455672", cursor: "pointer" }}
                >
                  <span>ค่าใช้จ่ายทั่วไป <span style={{ opacity: 0.6 }}>{expCollapsed ? "▶" : "▼"}</span></span>
                  <span style={{ color: "#ef4444" }}>{THB(genTotal)}</span>
                </button>
                {!expCollapsed && activeGeneral.map(c => (
                  <div key={c} className="flex justify-between px-8 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                    <span style={{ color: "#cdd5e0" }}>{acctName(c)}</span>
                    <span style={{ color: "#ef4444" }}>{THB(g(c))}</span>
                  </div>
                ))}
              </>
            )}

            {/* ภาษีและค่าธรรมเนียมภาครัฐ group — collapsible */}
            {Math.abs(taxTotal) > EPS && (
              <>
                <button
                  onClick={() => setTaxCollapsed(p => !p)}
                  className="w-full flex justify-between items-center px-4 py-1.5 text-xs font-medium text-left"
                  style={{ background: "#0f1828", borderTop: "0.5px solid #16243a", color: "#455672", cursor: "pointer" }}
                >
                  <span>ภาษีและค่าธรรมเนียมภาครัฐ <span style={{ opacity: 0.6 }}>{taxCollapsed ? "▶" : "▼"}</span></span>
                  <span style={{ color: "#ef4444" }}>{THB(taxTotal)}</span>
                </button>
                {!taxCollapsed && activeTax.map(c => (
                  <div key={c} className="flex justify-between px-8 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                    <span style={{ color: "#cdd5e0" }}>{acctName(c)}</span>
                    <span style={{ color: "#ef4444" }}>{THB(g(c))}</span>
                  </div>
                ))}
              </>
            )}

            {/* Fixed financial expenses: interest, fee, depreciation */}
            {activeFixed.map(c => (
              <div key={c} className="flex justify-between px-6 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                <span style={{ color: "#cdd5e0" }}>{acctName(c)}</span>
                <span style={{ color: "#ef4444" }}>{THB(g(c))}</span>
              </div>
            ))}
          </>
        }

        <div className="flex justify-between px-4 py-2.5 text-sm font-semibold" style={{ borderTop: "1px solid #1e3050", background: "#0f1828", color: "#ef4444" }}>
          <span>รวมค่าใช้จ่าย</span><span>{THB(totalExp)}</span>
        </div>
      </div>

      {/* Net */}
      <div className="rounded-xl p-5 text-center" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <div className="text-xs mb-1" style={{ color: "#455672" }}>
          กำไร (ขาดทุน) {selectedMonth === "all" ? "สุทธิ" : `ของ ${periodLabel}`} / Net Income
        </div>
        <div className="text-3xl font-bold" style={{ color: netIncome >= 0 ? "#22c55e" : "#ef4444" }}>
          {netIncome < 0 ? "-" : "+"}฿{THB(Math.abs(netIncome)).replace("฿","")}
        </div>
        <div className="text-xs mt-1" style={{ color: "#455672" }}>
          {selectedMonth === "all" ? "→ ส่งเข้างบดุล Equity อัตโนมัติ" : "→ ผลรวมของเดือนนี้"}
        </div>
      </div>
    </AppShell>
  );
}
