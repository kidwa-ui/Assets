"use client";
import { useState, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { THB, fmt, COA } from "@/lib/balance";
import { SCENARIOS, PM_BANK, PM_ASSET_ACCT, PM_LIAB_ACCT, type Scenario } from "@/lib/scenarios";

const ALL_PM = [...PM_BANK, ...PM_ASSET_ACCT, ...PM_LIAB_ACCT];

function getPMPool(s: Scenario, ccCards: { id: string; name: string; account_code: string }[]) {
  const ccPM = ccCards.map(c => ({ id: "cc:" + c.id, name: "💳 " + c.name, acct: c.account_code }));
  if (s.pmRole === "receive") return PM_BANK;
  if (s.pmRole === "asset_acct") return PM_ASSET_ACCT;
  if (s.pmRole === "liab_acct") return PM_LIAB_ACCT;
  return [...PM_BANK, ...ccPM];
}

function resolvePM(pmId: string, ccCards: { id: string; name: string; account_code: string }[]) {
  if (pmId.startsWith("cc:")) {
    const c = ccCards.find(x => "cc:" + x.id === pmId);
    return c ? { id: pmId, name: "💳 " + c.name, acct: c.account_code } : undefined;
  }
  return ALL_PM.find(p => p.id === pmId);
}

function resolveEntry(scen: Scenario, pmId: string, ccCards: { id: string; name: string; account_code: string }[]) {
  const pm = resolvePM(pmId, ccCards);
  if (scen.pmRole !== "none" && !pm) return null;
  const dr = scen.dr === "PM" ? pm?.acct : scen.dr;
  const cr = scen.cr === "PM" ? pm?.acct : scen.cr;
  if (!dr || !cr) return null;
  return {
    dr, cr,
    drName: scen.dr === "PM" ? (pm?.name || dr) : (COA[dr]?.name || dr),
    crName: scen.cr === "PM" ? (pm?.name || cr) : (COA[cr]?.name || cr),
  };
}

export default function JournalPage() {
  const { txns, ccCards, addTransaction, deleteTransaction, summary, loading } = useFinance();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", desc: "", scenId: "", pmId: "", amount: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const scen = SCENARIOS.find(s => s.id === form.scenId);
  const pmPool = scen ? getPMPool(scen, ccCards) : [];
  const entry = scen ? resolveEntry(scen, form.pmId, ccCards) : null;
  const needsPM = scen && scen.pmRole !== "none";

  const groups = useMemo(() => {
    const g: Record<string, Scenario[]> = {};
    SCENARIOS.forEach(s => { if (!g[s.group]) g[s.group] = []; g[s.group].push(s); });
    return g;
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.date || !form.desc || !form.scenId || !form.amount) { setErr("กรุณากรอกให้ครบ"); return; }
    if (needsPM && !form.pmId) { setErr("กรุณาเลือก" + (scen?.pmLabel || "ช่องทาง")); return; }
    if (!entry) { setErr("ไม่สามารถ generate Dr/Cr ได้"); return; }
    setSaving(true);
    const { error } = await addTransaction({
      date: form.date, description: form.desc,
      dr_account: entry.dr, cr_account: entry.cr,
      dr_name: entry.drName, cr_name: entry.crName,
      amount: parseFloat(form.amount), is_system: false,
    });
    if (error) setErr(error.message);
    else { setForm({ date: "", desc: "", scenId: "", pmId: "", amount: "" }); setErr(""); setOpen(false); }
    setSaving(false);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  return (
    <AppShell netWorth={summary.totalEquity} netIncome={summary.netIncome} balanced={summary.balanced}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-medium text-white">📒 Journal</h1>
        <button onClick={() => setOpen(!open)} className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
          + บันทึกรายการ
        </button>
      </div>

      {/* Form */}
      {open && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#0b1220", border: "0.5px solid #3b82f644" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#93c5fd" }}>✍️ บันทึกรายการใหม่</p>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>วันที่</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>รายการ</label>
              <input type="text" value={form.desc} onChange={e => set("desc", e.target.value)} placeholder="อธิบายรายการ..." style={{ textAlign: "left" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>จำนวน ฿</label>
              <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ประเภทรายการ</label>
              <select value={form.scenId} onChange={e => { set("scenId", e.target.value); set("pmId", ""); }}>
                <option value="">— เลือกประเภท —</option>
                {Object.entries(groups).map(([g, items]) => (
                  <optgroup key={g} label={g}>
                    {items.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {scen?.hint && <div className="mt-1.5 text-xs px-2 py-1.5 rounded" style={{ background: "#1a1000", color: "#f59e0b", borderLeft: "2px solid #f59e0b" }}>{scen.hint}</div>}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>
              {scen?.pmLabel || "ช่องทาง"}{!needsPM && " (ไม่จำเป็น)"}
            </label>
            <select value={form.pmId} onChange={e => set("pmId", e.target.value)} disabled={!needsPM} style={{ opacity: needsPM ? 1 : 0.4 }}>
              <option value="">— เลือก —</option>
              {pmPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Preview */}
          {entry && parseFloat(form.amount) > 0 && (
            <div className="mb-3 rounded-lg overflow-hidden" style={{ border: "0.5px solid #16243a" }}>
              <div className="flex">
                <div className="flex-1 px-3 py-2" style={{ background: "#0a1628" }}>
                  <div className="text-xs mb-1" style={{ color: "#455672" }}>DEBIT — {scen?.pmRole === "receive" ? "บัญชีรับเงิน" : "บัญชีที่เพิ่ม"}</div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>{entry.dr}</span>
                  <span className="text-xs" style={{ color: "#93c5fd" }}>{entry.drName}</span>
                </div>
                <div className="flex-1 px-3 py-2" style={{ background: "#160a0a" }}>
                  <div className="text-xs mb-1" style={{ color: "#455672" }}>CREDIT — บัญชีที่ลด/หนี้เพิ่ม</div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>{entry.cr}</span>
                  <span className="text-xs" style={{ color: "#fca5a5" }}>{entry.crName}</span>
                </div>
                <div className="px-3 py-2 flex items-center" style={{ background: "#0a160a" }}>
                  <span className="text-sm font-medium" style={{ color: "#4ade80" }}>{THB(parseFloat(form.amount || "0"))}</span>
                </div>
              </div>
            </div>
          )}

          {err && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{err}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["วันที่", "รายการ", "Dr", "Cr", "฿", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium" style={{ color: "#455672", borderBottom: "0.5px solid #16243a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-sm text-center" style={{ color: "#455672" }}>ยังไม่มีรายการ</td></tr>
              ) : [...txns].reverse().map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? "transparent" : "#0f1828" }}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: "#455672" }}>{t.date}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.is_system && <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#0f2200", color: "#a3e635", fontSize: 9 }}>auto</span>}
                    <span style={{ color: "#cdd5e0" }}>{t.description}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="inline-block px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa", fontSize: 10 }}>{t.dr_account}</span>
                    <span style={{ color: "#93c5fd" }}>{t.dr_name}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="inline-block px-1.5 py-0.5 rounded font-bold mr-1" style={{ background: "#3f1515", color: "#f87171", fontSize: 10 }}>{t.cr_account}</span>
                    <span style={{ color: "#fca5a5" }}>{t.cr_name}</span>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium text-right whitespace-nowrap" style={{ color: "#e2e8f0" }}>{fmt(t.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    {!t.is_system && (
                      <button onClick={() => { if (confirm("ลบรายการนี้?")) deleteTransaction(t.id!); }}
                        className="text-xs px-2 py-0.5 rounded" style={{ color: "#ef4444", border: "0.5px solid #ef444433" }}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
