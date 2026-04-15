"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { netBal, THB, fmt } from "@/lib/balance";
import { PM_BANK } from "@/lib/scenarios";

export default function CreditCardsPage() {
  const { ccCards, ccStatements, summary, loading, addCCCard, deleteCCCard, syncCCStatement } = useFinance();
  const [open, setOpen] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", acct: "2110", bankId: "kbank" });
  const [stmtForms, setStmtForms] = useState<Record<string, { stmtDate: string; stmtBal: string; paidDate: string; paidAmt: string; bankId: string }>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function getStmt(cid: string, bankId: string) {
    return stmtForms[cid] || { stmtDate: new Date().toISOString().slice(0, 10), stmtBal: "", paidDate: new Date().toISOString().slice(0, 10), paidAmt: "", bankId };
  }
  function setStmt(cid: string, k: string, v: string, bankId: string) {
    setStmtForms(p => ({ ...p, [cid]: { ...getStmt(cid, bankId), [k]: v } }));
  }

  async function handleSaveCard() {
    if (!newCard.name) { setErr("กรุณากรอกชื่อบัตร"); return; }
    setSaving(true);
    await addCCCard({ name: newCard.name, account_code: newCard.acct, bank_id: newCard.bankId });
    setNewCard({ name: "", acct: "2110", bankId: "kbank" });
    setErr(""); setOpen(false); setSaving(false);
  }

  async function handleSync(cid: string, cacct: string, cname: string, defBank: string) {
    const f = getStmt(cid, defBank);
    if (!f.stmtDate || !f.stmtBal) { alert("กรุณากรอกวันตัดรอบและยอด"); return; }
    const bk = PM_BANK.find(p => p.id === f.bankId);
    setSaving(true);
    await syncCCStatement({
      cardId: cid, cardAcct: cacct, stmtDate: f.stmtDate,
      stmtBalance: parseFloat(f.stmtBal),
      paidDate: f.paidDate, paidAmount: parseFloat(f.paidAmt) || 0,
      bankAcct: bk?.acct || "1120", bankName: bk?.name || "ธนาคาร", cardName: cname,
    });
    setStmtForms(p => ({ ...p, [cid]: { stmtDate: "", stmtBal: "", paidDate: "", paidAmt: "", bankId: defBank } }));
    setSaving(false);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  return (
    <AppShell netWorth={summary.totalEquity} netIncome={summary.netIncome} balanced={summary.balanced}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-medium text-white">💳 บัตรเครดิต</h1>
        <button onClick={() => setOpen(!open)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
          + เพิ่มบัตร
        </button>
      </div>

      {/* Add card form */}
      {open && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#0b1220", border: "0.5px solid #3b82f644" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#93c5fd" }}>+ เพิ่มบัตรเครดิต</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อบัตร</label>
              <input type="text" value={newCard.name} onChange={e => setNewCard(p => ({ ...p, name: e.target.value }))} placeholder="เช่น KBank Platinum" style={{ textAlign: "left" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีหนี้สิน</label>
              <select value={newCard.acct} onChange={e => setNewCard(p => ({ ...p, acct: e.target.value }))}>
                <option value="2110">เจ้าหนี้บัตรเครดิต</option>
                <option value="2120">BNPL/ผ่อนชำระ</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีธนาคารที่ผูก</label>
              <select value={newCard.bankId} onChange={e => setNewCard(p => ({ ...p, bankId: e.target.value }))}>
                {PM_BANK.filter(p => p.id !== "cash").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{err}</p>}
          <div className="flex gap-2">
            <button onClick={handleSaveCard} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>เพิ่มบัตร</button>
            <button onClick={() => { setOpen(false); setErr(""); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {ccCards.length === 0 && !open && (
        <div className="rounded-xl px-4 py-8 text-center text-sm mb-4" style={{ background: "#0b1220", border: "0.5px solid #16243a", color: "#455672" }}>ยังไม่มีบัตรเครดิต</div>
      )}

      {ccCards.map(c => {
        const bal = netBal(summary.balances, c.account_code);
        const f = getStmt(c.id, c.bank_id);
        const curBal = (summary.balances[c.account_code] || 0) * -1;
        const stmtNum = parseFloat(f.stmtBal) || 0;
        const diff = stmtNum - curBal;

        return (
          <div key={c.id} className="rounded-xl p-4 mb-3" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="font-medium text-sm text-white">💳 {c.name}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs" style={{ color: "#455672" }}>ยอดหนี้ในระบบ</div>
                  <div className="font-semibold text-base" style={{ color: "#ef4444" }}>{THB(bal)}</div>
                </div>
                <button onClick={() => { if (confirm("ลบบัตรนี้?")) deleteCCCard(c.id); }}
                  className="text-xs px-2 py-1 rounded" style={{ color: "#ef4444", border: "0.5px solid #ef444433" }}>✕</button>
              </div>
            </div>

            <div className="rounded-lg p-3" style={{ background: "#0f1828" }}>
              <p className="text-xs font-medium mb-3" style={{ color: "#60a5fa" }}>📄 Statement Sync</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>วันตัดรอบ</label>
                  <input type="date" value={f.stmtDate} onChange={e => setStmt(c.id, "stmtDate", e.target.value, c.bank_id)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ยอดตาม Statement ฿</label>
                  <input type="number" value={f.stmtBal} onChange={e => setStmt(c.id, "stmtBal", e.target.value, c.bank_id)} placeholder="ยอดที่ธนาคารแจ้ง" />
                  <div className="text-xs mt-1" style={{ color: "#455672" }}>ในระบบ: {THB(bal)}</div>
                  {stmtNum > 0 && (
                    <div className="text-xs mt-1" style={{ color: Math.abs(diff) < 1 ? "#22c55e" : diff > 0 ? "#ef4444" : "#f59e0b" }}>
                      {Math.abs(diff) < 1 ? "✅ ตรงกัน" : diff > 0 ? `⚠ เกิน ${THB(diff)} (auto: ดอกเบี้ย)` : `ต่ำกว่า ${THB(Math.abs(diff))}`}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>วันที่ชำระ</label>
                  <input type="date" value={f.paidDate} onChange={e => setStmt(c.id, "paidDate", e.target.value, c.bank_id)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ยอดที่ชำระ ฿</label>
                  <input type="number" value={f.paidAmt} onChange={e => setStmt(c.id, "paidAmt", e.target.value, c.bank_id)} placeholder="จ่ายเท่าไหร่?" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีโอนจ่าย</label>
                  <select value={f.bankId} onChange={e => setStmt(c.id, "bankId", e.target.value, c.bank_id)}>
                    {PM_BANK.filter(p => p.id !== "cash").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => handleSync(c.id, c.account_code, c.name, c.bank_id)} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>
                บันทึก Statement Sync
              </button>
            </div>
          </div>
        );
      })}

      {/* History */}
      {ccStatements.length > 0 && (
        <div className="rounded-xl overflow-hidden mt-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
          <div className="px-4 py-2 text-xs font-medium text-white" style={{ background: "#1e3a8a" }}>ประวัติ Statement Sync</div>
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr>
              {["บัตร","วันตัดรอบ","ยอด Stmt","ดอกเบี้ย","ชำระ"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#455672", borderBottom: "0.5px solid #16243a" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ccStatements.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "transparent" : "#0f1828" }}>
                  <td className="px-3 py-2 text-xs" style={{ color: "#cdd5e0" }}>{ccCards.find(c => c.id === s.card_id)?.name || "(ลบแล้ว)"}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "#455672" }}>{s.statement_date}</td>
                  <td className="px-3 py-2 text-xs text-right">{THB(s.statement_balance)}</td>
                  <td className="px-3 py-2 text-xs text-right" style={{ color: "#ef4444" }}>{s.interest_amount > 0 ? THB(s.interest_amount) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-right" style={{ color: "#22c55e" }}>{s.paid_amount > 0 ? THB(s.paid_amount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
