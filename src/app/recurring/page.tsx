"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { COA, netBal, THB, fmt } from "@/lib/balance";

export default function RecurringPage() {
  const { schedules, ccCards, userBanks, userLiabs, summary, loading, addSchedule, deleteSchedule, confirmSchedInterest } = useFinance();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", liabId: "", bankId: "", rate: "", total: "", defInt: "", day: "", next: "" });
  const [confirmInts, setConfirmInts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const homeLoans     = userLiabs.filter(l => l.type === "home");
  const carLoans      = userLiabs.filter(l => l.type === "car");
  const personalLoans = userLiabs.filter(l => l.type === "personal");

  const liabOptions = [
    // Show individual home loans if any, otherwise show parent
    ...(homeLoans.length > 0
      ? homeLoans.map(l => ({ id: "ul:" + l.id, label: "🏠 " + l.name }))
      : [{ id: "2210", label: "🏠 สินเชื่อบ้าน" }]),
    // Show individual car loans if any, otherwise show parent
    ...(carLoans.length > 0
      ? carLoans.map(l => ({ id: "ul:" + l.id, label: "🚗 " + l.name }))
      : [{ id: "2220", label: "🚗 สินเชื่อรถ" }]),
    // Show individual personal loans if any, otherwise show parent
    ...(personalLoans.length > 0
      ? personalLoans.map(l => ({ id: "ul:" + l.id, label: "💼 " + l.name }))
      : [{ id: "2230", label: "💼 เงินกู้ส่วนบุคคล" }]),
    { id: "2120", label: "🛒 BNPL" },
    ...ccCards.map(c => ({ id: "cc:" + c.id, label: "💳 " + c.name })),
  ];

  function resolveLibName(liabId: string) {
    if (liabId.startsWith("cc:")) return ccCards.find(c => "cc:" + c.id === liabId)?.name || "บัตรเครดิต";
    if (liabId.startsWith("ul:")) return userLiabs.find(l => "ul:" + l.id === liabId)?.name || liabId;
    return COA[liabId]?.name || liabId;
  }
  function resolveLibAcct(liabId: string) {
    if (liabId.startsWith("cc:")) return ccCards.find(c => "cc:" + c.id === liabId)?.account_code || "2110";
    if (liabId.startsWith("ul:")) return userLiabs.find(l => "ul:" + l.id === liabId)?.account_code || liabId;
    return liabId;
  }

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.name || !form.liabId || !form.total || !form.day || !form.next) { setErr("กรุณากรอกให้ครบ"); return; }
    setSaving(true);
    await addSchedule({
      name: form.name, liability_id: form.liabId, bank_id: form.bankId,
      interest_rate: parseFloat(form.rate) || 0, default_total: parseFloat(form.total),
      confirmed_interest: null, day_of_month: parseInt(form.day), next_date: form.next, is_active: true,
    });
    setForm({ name: "", liabId: "", bankId: "kbank", rate: "", total: "", defInt: "", day: "", next: "" });
    setErr(""); setOpen(false); setSaving(false);
  }

  async function handleConfirmInt(schedId: string) {
    const val = parseFloat(confirmInts[schedId] || "0");
    await confirmSchedInterest(schedId, val);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  return (
    <AppShell netWorth={summary.totalEquity} netIncome={summary.netIncome} balanced={summary.balanced}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-medium text-white">🔄 Recurring Schedules</h1>
        <button onClick={() => setOpen(!open)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
          + เพิ่ม Schedule
        </button>
      </div>

      {/* Add form */}
      {open && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#0b1220", border: "0.5px solid #3b82f644" }}>
          <p className="text-sm font-medium mb-3" style={{ color: "#93c5fd" }}>+ เพิ่ม Recurring Schedule</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อ</label>
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="เช่น ผ่อนรถ Toyota" style={{ textAlign: "left" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีหนี้สิน / บัตรเครดิต</label>
              <select value={form.liabId} onChange={e => set("liabId", e.target.value)}>
                <option value="">— เลือก —</option>
                {liabOptions.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ยอดผ่อน/เดือน ฿</label>
              <input type="number" value={form.total} onChange={e => set("total", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>%ดอกเบี้ย/ปี</label>
              <input type="number" value={form.rate} onChange={e => set("rate", e.target.value)} step="0.01" placeholder="เช่น 2.79" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>วันที่ผ่อนทุกเดือน</label>
              <input type="number" value={form.day} onChange={e => set("day", e.target.value)} min="1" max="31" placeholder="เช่น 28" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีธนาคารที่ตัดจ่าย</label>
              <select value={form.bankId} onChange={e => set("bankId", e.target.value)}>
                <option value="">— เลือกธนาคาร —</option>
                {userBanks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>วันครบกำหนดงวดแรก</label>
            <input type="date" value={form.next} onChange={e => set("next", e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          {err && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{err}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>บันทึก</button>
            <button onClick={() => { setOpen(false); setErr(""); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {schedules.length === 0 && !open && (
        <div className="rounded-xl px-4 py-8 text-center text-sm" style={{ background: "#0b1220", border: "0.5px solid #16243a", color: "#455672" }}>
          ยังไม่มี Schedule
        </div>
      )}

      {schedules.map(s => {
        const acct = resolveLibAcct(s.liability_id);
        const bal = netBal(summary.balances, acct);
        const estInt = s.interest_rate > 0 ? Math.round(bal * s.interest_rate / 100 / 12) : 0;
        const ciVal = confirmInts[s.id] ?? (s.confirmed_interest !== null ? String(s.confirmed_interest) : String(estInt));

        return (
          <div key={s.id} className="rounded-xl p-4 mb-3" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-medium text-sm text-white">{s.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "#455672" }}>{resolveLibName(s.liability_id)} · วันที่ {s.day_of_month} ทุกเดือน</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs" style={{ color: "#455672" }}>หนี้คงเหลือ</div>
                  <div className="font-medium text-sm" style={{ color: "#ef4444" }}>{THB(bal)}</div>
                </div>
                <button onClick={() => { if (confirm("ลบ Schedule นี้?")) deleteSchedule(s.id); }}
                  className="text-xs px-2 py-1 rounded" style={{ color: "#ef4444", border: "0.5px solid #ef444433" }}>✕</button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
              <div className="rounded-lg p-2.5" style={{ background: "#0f1828" }}>
                <div className="text-xs mb-1" style={{ color: "#455672" }}>ยอดผ่อน/เดือน</div>
                <div className="font-medium text-white">{THB(s.default_total)}</div>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: "#0f1828" }}>
                <div className="text-xs mb-1" style={{ color: "#455672" }}>%ดอกเบี้ย/ปี</div>
                <div className="font-medium text-white">{s.interest_rate}%</div>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: "#0f1828" }}>
                <div className="text-xs mb-1" style={{ color: "#455672" }}>ดอกเบี้ยประมาณการ</div>
                <div className="font-medium" style={{ color: "#f59e0b" }}>{THB(estInt)}/เดือน</div>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: "#0f1828" }}>
                <div className="text-xs mb-1" style={{ color: "#455672" }}>งวดถัดไป</div>
                <div className="font-medium text-white">{s.next_date}</div>
              </div>
            </div>

            {/* ยืนยันดอกเบี้ย */}
            <div className="rounded-lg p-3" style={{ background: s.confirmed_interest !== null ? "#052e1644" : "#0f1828", border: `0.5px solid ${s.confirmed_interest !== null ? "#22c55e44" : "#16243a"}` }}>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-40">
                  <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>
                    ยืนยันดอกเบี้ยงวด {s.next_date} ฿
                  </label>
                  <input type="number" value={ciVal}
                    onChange={e => setConfirmInts(p => ({ ...p, [s.id]: e.target.value }))}
                    placeholder="กรอกตาม statement"
                    style={{ borderColor: s.confirmed_interest !== null ? "#22c55e44" : "" }} />
                  <div className="text-xs mt-1" style={{ color: "#455672" }}>ประมาณการ: {THB(estInt)}/เดือน</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleConfirmInt(s.id)} className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb" }}>
                    {s.confirmed_interest !== null ? "✓ อัปเดต" : "ยืนยัน → ส่ง Upcoming"}
                  </button>
                  {s.confirmed_interest !== null && (
                    <button onClick={() => confirmSchedInterest(s.id, 0)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>รีเซ็ต</button>
                  )}
                </div>
              </div>
              {s.confirmed_interest !== null && (
                <div className="text-xs mt-2" style={{ color: "#22c55e" }}>✅ ดอกเบี้ย {THB(s.confirmed_interest)} ส่งไป Upcoming แล้ว</div>
              )}
            </div>
          </div>
        );
      })}
    </AppShell>
  );
}
