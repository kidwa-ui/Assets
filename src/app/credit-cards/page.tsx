"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { netBal, THB, fmt } from "@/lib/balance";

const BANK_TYPES: Record<string, string> = {
  savings: "ออมทรัพย์", fixed: "ฝากประจำ", current: "กระแสรายวัน", other: "อื่นๆ",
};

export default function CreditCardsPage() {
  const { ccCards, ccStatements, summary, userBanks, loading, addCCCard, addTransaction, deleteCCCard, syncCCStatement, userCreatedAt } = useFinance();
  const [open, setOpen] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", card_type: "credit", bank_id: "", initBal: "" });
  const [stmtForms, setStmtForms] = useState<Record<string, { stmtDate: string; stmtBal: string; paidDate: string; paidAmt: string; bankId: string }>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function getStmt(cid: string, defBankId: string) {
    return stmtForms[cid] || { stmtDate: new Date().toISOString().slice(0, 10), stmtBal: "", paidDate: new Date().toISOString().slice(0, 10), paidAmt: "", bankId: defBankId };
  }
  function setStmt(cid: string, k: string, v: string, defBankId: string) {
    setStmtForms(p => ({ ...p, [cid]: { ...getStmt(cid, defBankId), [k]: v } }));
  }

  async function handleSaveCard() {
    if (!newCard.name.trim()) { setErr("กรุณากรอกชื่อบัตร/บริการ"); return; }
    setSaving(true);
    const { card, error } = await addCCCard({ name: newCard.name.trim(), card_type: newCard.card_type, bank_id: newCard.bank_id });
    if (error || !card) { setErr(error?.message || "สร้างไม่สำเร็จ"); setSaving(false); return; }

    const bal = parseFloat(newCard.initBal) || 0;
    if (bal > 0) {
      const label = `${newCard.card_type === "bnpl" ? "🛒" : "💳"} ${card.name}`;
      await addTransaction({
        date: userCreatedAt || new Date().toISOString().slice(0, 10),
        description: `หนี้${card.name} เริ่มต้น`,
        dr_account: "3100", cr_account: card.account_code,
        dr_name: "Opening Equity", cr_name: label,
        amount: bal, is_system: false,
      });
    }
    setNewCard({ name: "", card_type: "credit", bank_id: "", initBal: "" });
    setErr(""); setOpen(false); setSaving(false);
  }

  async function handleSync(cid: string, cacct: string, cname: string, defBankId: string) {
    const f = getStmt(cid, defBankId);
    if (!f.stmtDate || !f.stmtBal) { alert("กรุณากรอกวันตัดรอบและยอด"); return; }
    const bank = userBanks.find(b => b.id === f.bankId);
    if (!bank) { alert("กรุณาเลือกบัญชีธนาคารที่ชำระ"); return; }
    setSaving(true);
    await syncCCStatement({
      cardId: cid, cardAcct: cacct, stmtDate: f.stmtDate,
      stmtBalance: parseFloat(f.stmtBal),
      paidDate: f.paidDate, paidAmount: parseFloat(f.paidAmt) || 0,
      bankAcct: bank.account_code,
      bankName: `${bank.name} (${BANK_TYPES[bank.type] ?? bank.type})`,
      cardName: cname,
    });
    setStmtForms(p => ({ ...p, [cid]: { stmtDate: "", stmtBal: "", paidDate: "", paidAmt: "", bankId: defBankId } }));
    setSaving(false);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const { balances } = summary;
  const dynamicCOA = Object.fromEntries(
    ccCards.map(c => [c.account_code, { name: c.name, type: "liability" as const, normal: "credit" as const }])
  );

  const creditCards = ccCards.filter(c => c.card_type === "credit");
  const bnplCards   = ccCards.filter(c => c.card_type === "bnpl");

  function CardSection({ cards, emoji, typeLabel }: { cards: typeof ccCards; emoji: string; typeLabel: string }) {
    if (cards.length === 0) return null;
    return (
      <>
        <div className="text-xs font-medium mb-2 mt-4" style={{ color: "#455672" }}>{emoji} {typeLabel}</div>
        {cards.map(c => {
          const bal = netBal(balances, c.account_code, dynamicCOA);
          const f = getStmt(c.id, c.bank_id);
          const curBal = -(balances[c.account_code] || 0);
          const stmtNum = parseFloat(f.stmtBal) || 0;
          const diff = stmtNum - curBal;

          return (
            <div key={c.id} className="rounded-xl p-4 mb-3" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
              <div className="flex justify-between items-center mb-3">
                <div className="font-medium text-sm text-white">{emoji} {c.name}</div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs" style={{ color: "#455672" }}>ยอดหนี้ในระบบ</div>
                    <div className="font-semibold text-base" style={{ color: "#ef4444" }}>{THB(bal)}</div>
                  </div>
                  <button onClick={() => { if (confirm("ลบรายการนี้?")) deleteCCCard(c.id); }}
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
                    <input type="number" value={f.stmtBal} onChange={e => setStmt(c.id, "stmtBal", e.target.value, c.bank_id)} placeholder="ยอดที่แจ้ง" />
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
                    {userBanks.length === 0 ? (
                      <div className="text-xs px-2 py-1.5 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>
                        ยังไม่มีบัญชีธนาคาร
                      </div>
                    ) : (
                      <select value={f.bankId} onChange={e => setStmt(c.id, "bankId", e.target.value, c.bank_id)}>
                        <option value="">— เลือกธนาคาร —</option>
                        {userBanks.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({BANK_TYPES[b.type] ?? b.type})</option>
                        ))}
                      </select>
                    )}
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
      </>
    );
  }

  return (
    <AppShell netWorth={summary.totalEquity} netIncome={summary.netIncome} balanced={summary.balanced}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-medium text-white">💳 บัตรเครดิต & BNPL</h1>
        <button onClick={() => setOpen(!open)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
          + เพิ่มบัตร/บริการ
        </button>
      </div>

      {/* Add card form */}
      {open && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#0b1220", border: "0.5px solid #3b82f644" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#93c5fd" }}>+ เพิ่มบัตรเครดิต / BNPL</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อบัตร / บริการ</label>
              <input type="text" value={newCard.name} onChange={e => setNewCard(p => ({ ...p, name: e.target.value }))}
                placeholder="เช่น KBank Platinum, Shopee S Pay Later" style={{ textAlign: "left" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ประเภท</label>
              <select value={newCard.card_type} onChange={e => setNewCard(p => ({ ...p, card_type: e.target.value }))}>
                <option value="credit">💳 บัตรเครดิต</option>
                <option value="bnpl">🛒 BNPL / Pay Later</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ยอดหนี้เริ่มต้น ฿ (ถ้ามี, ใส่ 0 ได้)</label>
            <input type="number" value={newCard.initBal} onChange={e => setNewCard(p => ({ ...p, initBal: e.target.value }))} placeholder="0.00" min="0" />
            <div className="mt-1 text-xs" style={{ color: "#455672" }}>
              หากมียอดหนี้เริ่มต้น ระบบจะสร้าง Opening Balance transaction ให้อัตโนมัติ
            </div>
          </div>
          {err && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{err}</p>}
          <div className="flex gap-2">
            <button onClick={handleSaveCard} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>เพิ่ม</button>
            <button onClick={() => { setOpen(false); setErr(""); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {ccCards.length === 0 && !open && (
        <div className="rounded-xl px-4 py-8 text-center text-sm mb-4" style={{ background: "#0b1220", border: "0.5px solid #16243a", color: "#455672" }}>
          <div>ยังไม่มีบัตรเครดิต / BNPL</div>
          <div className="mt-1 text-xs">เพิ่มจากปุ่มด้านบน หรือบันทึกผ่าน Journal &gt; Opening Balance</div>
        </div>
      )}

      {CardSection({ cards: creditCards, emoji: "💳", typeLabel: "บัตรเครดิต" })}
      {CardSection({ cards: bnplCards,   emoji: "🛒", typeLabel: "BNPL / Pay Later" })}

      {/* History */}
      {ccStatements.length > 0 && (
        <div className="rounded-xl overflow-hidden mt-4" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
          <div className="px-4 py-2 text-xs font-medium text-white" style={{ background: "#1e3a8a" }}>ประวัติ Statement Sync</div>
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr>
              {["บัตร/บริการ","วันตัดรอบ","ยอด Stmt","ดอกเบี้ย","ชำระ"].map(h => (
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
