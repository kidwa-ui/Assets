"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { COA, netBal, THB } from "@/lib/balance";

const EXP_SUB_CODES = ["5001","5002","5003","5004","5005","5006","5007","5008","5009","5010","5011","5012","5013","5014","5015"];
const EXP_OTHER_CODES = ["5000"];
const EXP_FIXED_CODES = ["5510","5520","5530"];

export default function PLPage() {
  const { summary, loading } = useFinance();
  const [expCollapsed, setExpCollapsed] = useState(true);
  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const { balances, totalInc, totalExp, netIncome, totalEquity, balanced } = summary;
  const g = (c: string) => netBal(balances, c);

  const incGroups = [
    { label: "รายได้จากการทำงาน",  codes: ["4100","4200"] },
    { label: "รายได้จากทรัพย์สิน", codes: ["4300","4430"] },
    { label: "รายได้จากการลงทุน",  codes: ["4410","4420"] },
    { label: "รายได้อื่นๆ",        codes: ["4440","4490"] },
  ];

  const subTotal   = EXP_SUB_CODES.reduce((s, c) => s + g(c), 0);
  const otherTotal = EXP_OTHER_CODES.reduce((s, c) => s + g(c), 0);
  const genTotal   = subTotal + otherTotal;
  const activeSubs = EXP_SUB_CODES.filter(c => g(c) > 0);
  const activeOther = EXP_OTHER_CODES.filter(c => g(c) > 0);
  const activeFixed = EXP_FIXED_CODES.filter(c => g(c) > 0);

  return (
    <AppShell netWorth={totalEquity} netIncome={netIncome} balanced={balanced}>
      <h1 className="text-base font-medium text-white mb-4">📈 P&L / งบกำไรขาดทุน</h1>

      {/* Income */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <div className="px-4 py-2 text-xs font-medium text-white" style={{ background: "#1e3a8a" }}>INCOME</div>
        {incGroups.map(gr => {
          const rows = gr.codes.filter(c => g(c) > 0);
          if (!rows.length) return null;
          return (
            <div key={gr.label}>
              <div className="px-4 py-1.5 text-xs font-medium" style={{ background: "#0f1828", borderTop: "0.5px solid #16243a", color: "#455672" }}>{gr.label}</div>
              {rows.map(c => (
                <div key={c} className="flex justify-between px-6 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                  <span style={{ color: "#cdd5e0" }}>{COA[c]?.name}</span>
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
            {genTotal > 0 && (
              <>
                <button
                  onClick={() => setExpCollapsed(p => !p)}
                  className="w-full flex justify-between items-center px-4 py-1.5 text-xs font-medium text-left"
                  style={{ background: "#0f1828", borderTop: "0.5px solid #16243a", color: "#455672", cursor: "pointer" }}
                >
                  <span>ค่าใช้จ่ายทั่วไป <span style={{ opacity: 0.6 }}>{expCollapsed ? "▶" : "▼"}</span></span>
                  <span style={{ color: "#ef4444" }}>{THB(genTotal)}</span>
                </button>
                {!expCollapsed && (
                  <>
                    {activeSubs.map(c => (
                      <div key={c} className="flex justify-between px-8 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                        <span style={{ color: "#cdd5e0" }}>{COA[c]?.name}</span>
                        <span style={{ color: "#ef4444" }}>{THB(g(c))}</span>
                      </div>
                    ))}
                    {activeOther.map(c => (
                      <div key={c} className="flex justify-between px-8 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                        <span style={{ color: "#cdd5e0" }}>{COA[c]?.name}</span>
                        <span style={{ color: "#ef4444" }}>{THB(g(c))}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Fixed expense codes: interest, fee, depreciation */}
            {activeFixed.map(c => (
              <div key={c} className="flex justify-between px-6 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a" }}>
                <span style={{ color: "#cdd5e0" }}>{COA[c]?.name}</span>
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
        <div className="text-xs mb-1" style={{ color: "#455672" }}>กำไร (ขาดทุน) สุทธิ / Net Income</div>
        <div className="text-3xl font-bold" style={{ color: netIncome >= 0 ? "#22c55e" : "#ef4444" }}>
          {netIncome < 0 ? "-" : "+"}฿{THB(Math.abs(netIncome)).replace("฿","")}
        </div>
        <div className="text-xs mt-1" style={{ color: "#455672" }}>→ ส่งเข้างบดุล Equity อัตโนมัติ</div>
      </div>
    </AppShell>
  );
}
