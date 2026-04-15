"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { COA, netBal, THB, fmt } from "@/lib/balance";

const MONTHS = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const mLabel = (m: string) => { const [y, mo] = m.split("-"); return MONTHS[+mo] + " " + y; };
const today = new Date().toISOString().slice(0, 10);
const curMonth = today.slice(0, 7);

export default function UpcomingPage() {
  const { queueItems, schedules, summary, loading, confirmQueueItem, skipQueueItem } = useFinance();
  const [month, setMonth] = useState(curMonth);
  const [editVals, setEditVals] = useState<Record<string, { date: string; total: string; interest: string }>>({});

  const months = [curMonth,
    new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 7),
    new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().slice(0, 7),
  ];

  const filtered = queueItems.filter(q => q.due_date.startsWith(month)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pending = filtered.filter(q => q.status === "pending");
  const done = filtered.filter(q => q.status !== "pending");

  function getVals(q: typeof pending[0]) {
    return editVals[q.id] || { date: q.due_date, total: String(q.default_total), interest: String(q.interest || 0) };
  }
  function setVal(id: string, k: string, v: string) {
    setEditVals(p => ({ ...p, [id]: { ...getVals({ id, due_date: "", default_total: 0, interest: 0, status: "pending", paid_date: null, paid_total: null, paid_principal: null, paid_interest: null, schedule_id: "" } as any), ...p[id], [k]: v } }));
  }

  async function handleConfirm(q: typeof pending[0]) {
    const sched = schedules.find(s => s.id === q.schedule_id);
    if (!sched) return;
    const vals = getVals(q);
    const total = parseFloat(vals.total) || 0;
    const interest = parseFloat(vals.interest) || 0;
    const principal = total - interest;
    const liab = sched.liability_id.startsWith("cc:") ? "2110" : sched.liability_id;
    const liabName = COA[liab]?.name || sched.name;
    await confirmQueueItem(q.id, { date: vals.date, total, interest, principal, liabAcct: liab, liabName, schedId: sched.id, dayOfMonth: sched.day_of_month });
  }

  async function handleSkip(q: typeof pending[0]) {
    const sched = schedules.find(s => s.id === q.schedule_id);
    if (!sched) return;
    await skipQueueItem(q.id, q.due_date, sched.id, sched.day_of_month);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const totalPending = queueItems.filter(q => q.status === "pending").length;

  return (
    <AppShell netWorth={summary.totalEquity} netIncome={summary.netIncome} balanced={summary.balanced} pendingCount={totalPending}>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h1 className="text-base font-medium text-white">📅 Upcoming — {mLabel(month)}</h1>
        <div className="flex gap-2 flex-wrap">
          {months.map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{ background: m === month ? "#2563eb" : "#0f1828", color: m === month ? "#fff" : "#455672", border: "0.5px solid #16243a" }}>
              {mLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {pending.length === 0 && (
        <div className="rounded-xl px-4 py-8 text-center text-sm" style={{ background: "#0b1220", border: "0.5px solid #16243a", color: "#455672" }}>
          ✅ ไม่มีรายการรอดำเนินการในเดือนนี้
        </div>
      )}

      {pending.map(q => {
        const sched = schedules.find(s => s.id === q.schedule_id);
        if (!sched) return null;
        const isOverdue = q.due_date < today;
        const isDueSoon = !isOverdue && q.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const vals = getVals(q);
        const total = parseFloat(vals.total) || 0;
        const interest = parseFloat(vals.interest) || 0;
        const principal = total - interest;
        const liab = sched.liability_id.startsWith("cc:") ? "2110" : sched.liability_id;
        const liabName = COA[liab]?.name || sched.name;
        const curBal = netBal(summary.balances, liab);
        const estInt = sched.interest_rate > 0 ? Math.round(curBal * sched.interest_rate / 100 / 12) : 0;

        return (
          <div key={q.id} className="rounded-xl p-4 mb-3"
            style={{ background: "#0b1220", border: `0.5px solid ${isOverdue ? "#ef444466" : isDueSoon ? "#f59e0b66" : "#16243a"}` }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-medium text-sm text-white">{sched.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "#455672" }}>{liabName} · {sched.interest_rate}%/ปี</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ color: isOverdue ? "#ef4444" : isDueSoon ? "#f59e0b" : "#455672", background: isOverdue ? "#ef444422" : isDueSoon ? "#f59e0b22" : "#0f1828", border: `0.5px solid ${isOverdue ? "#ef444444" : isDueSoon ? "#f59e0b44" : "#16243a"}` }}>
                {isOverdue ? "เกินกำหนด" : isDueSoon ? "ครบเร็วๆนี้" : "รอดำเนินการ"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>วันที่จ่ายจริง</label>
                <input type="date" value={vals.date} onChange={e => setVal(q.id, "date", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ยอดรวมที่จ่าย ฿</label>
                <input type="number" value={vals.total} onChange={e => setVal(q.id, "total", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: q.interest ? "#4ade80" : "#455672" }}>
                  ดอกเบี้ย ฿ {q.interest ? "(ยืนยันแล้ว)" : `(ประมาณ ${fmt(estInt)})`}
                </label>
                <input type="number" value={vals.interest} onChange={e => setVal(q.id, "interest", e.target.value)}
                  style={{ borderColor: q.interest ? "#22c55e44" : "" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#60a5fa" }}>เงินต้น ฿ (auto)</label>
                <input type="number" value={fmt(principal)} disabled />
              </div>
            </div>

            {/* Preview */}
            {total > 0 && (
              <div className="mb-3 space-y-1">
                {principal > 0 && (
                  <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: "0.5px solid #16243a" }}>
                    <div className="flex-1 px-3 py-1.5" style={{ background: "#0a1628" }}>
                      <span className="inline-block px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>{liab}</span>
                      <span style={{ color: "#93c5fd" }}>{liabName}</span>
                    </div>
                    <div className="flex-1 px-3 py-1.5" style={{ background: "#160a0a" }}>
                      <span className="inline-block px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>1120</span>
                      <span style={{ color: "#fca5a5" }}>เงินฝาก</span>
                    </div>
                    <div className="px-3 py-1.5 flex items-center" style={{ background: "#0a160a", color: "#4ade80", fontWeight: 500 }}>{THB(principal)}</div>
                  </div>
                )}
                {interest > 0 && (
                  <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: "0.5px solid #16243a" }}>
                    <div className="flex-1 px-3 py-1.5" style={{ background: "#0a1628" }}>
                      <span className="inline-block px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>5510</span>
                      <span style={{ color: "#93c5fd" }}>ดอกเบี้ยจ่าย</span>
                    </div>
                    <div className="flex-1 px-3 py-1.5" style={{ background: "#160a0a" }}>
                      <span className="inline-block px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>1120</span>
                      <span style={{ color: "#fca5a5" }}>เงินฝาก</span>
                    </div>
                    <div className="px-3 py-1.5 flex items-center" style={{ background: "#0a160a", color: "#4ade80", fontWeight: 500 }}>{THB(interest)}</div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => handleConfirm(q)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>
                ✓ Confirm & บันทึก
              </button>
              <button onClick={() => handleSkip(q)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>
                ข้ามงวดนี้
              </button>
            </div>
          </div>
        );
      })}

      {done.length > 0 && (
        <>
          <p className="text-xs mb-2 mt-4" style={{ color: "#455672" }}>ดำเนินการแล้วในเดือนนี้</p>
          <div className="rounded-xl overflow-hidden" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead><tr>
                {["รายการ","วันที่","สถานะ","เงินต้น","ดอกเบี้ย","รวม"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#455672", borderBottom: "0.5px solid #16243a" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {done.map((q, i) => (
                  <tr key={q.id} style={{ background: i % 2 === 0 ? "transparent" : "#0f1828" }}>
                    <td className="px-3 py-2 text-xs" style={{ color: "#cdd5e0" }}>{schedules.find(s => s.id === q.schedule_id)?.name}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#455672" }}>{q.paid_date || q.due_date}</td>
                    <td className="px-3 py-2 text-xs">
                      {q.status === "confirmed"
                        ? <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#0f2200", color: "#a3e635" }}>confirmed</span>
                        : <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "#1a1000", color: "#f59e0b" }}>skipped</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-right" style={{ color: "#cdd5e0" }}>{q.paid_principal ? THB(q.paid_principal) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-right" style={{ color: "#ef4444" }}>{q.paid_interest ? THB(q.paid_interest) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium" style={{ color: "#cdd5e0" }}>{q.paid_total ? THB(q.paid_total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
