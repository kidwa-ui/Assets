"use client";
import { useState, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { THB, fmt, COA, netBal } from "@/lib/balance";
import { SCENARIOS, PM_ASSET_ACCT, type Scenario } from "@/lib/scenarios";

const BANK_TYPES: Record<string, string> = {
  savings: "ออมทรัพย์", fixed: "ฝากประจำ", current: "กระแสรายวัน", other: "อื่นๆ",
};

const DUAL_PM_SCENS  = ["pay_cc", "pay_bnpl"];
const CARD_SETUP_SCENS = ["ob_cc", "ob_bnpl"];
const TRANSFER_SCENS = ["transfer_bank"];
const LIAB_SETUP_SCENS = ["ob_liab"];

function getPMPool(
  s: Scenario,
  ccCards: { id: string; name: string; card_type: string; account_code: string }[],
  userBanks: { id: string; name: string; type: string; account_code: string }[],
) {
  const cashPM = [{ id: "cash:1110", name: "💵 เงินสด", acct: "1110" }];
  const bankPM = userBanks.map(b => ({ id: "bank:" + b.id, name: `🏦 ${b.name} (${BANK_TYPES[b.type] ?? b.type})`, acct: b.account_code }));
  const ccPM   = ccCards.map(c => ({ id: "cc:" + c.id, name: `${c.card_type === "bnpl" ? "🛒" : "💳"} ${c.name}`, acct: c.account_code }));

  if (s.pmRole === "receive")     return [...cashPM, ...bankPM];
  if (s.pmRole === "asset_acct")  return PM_ASSET_ACCT;
  if (DUAL_PM_SCENS.includes(s.id)) return bankPM;
  if (TRANSFER_SCENS.includes(s.id)) return [...cashPM, ...bankPM];
  if (s.pmRole === "pay") return [...cashPM, ...bankPM, ...ccPM];
  return [];
}

function resolvePM(
  pmId: string,
  ccCards: { id: string; name: string; account_code: string }[],
  userBanks: { id: string; name: string; type: string; account_code: string }[],
) {
  if (pmId === "cash:1110") return { id: "cash:1110", name: "💵 เงินสด", acct: "1110" };
  if (pmId.startsWith("cc:")) {
    const c = ccCards.find(x => "cc:" + x.id === pmId);
    return c ? { id: pmId, name: "💳 " + c.name, acct: c.account_code } : undefined;
  }
  if (pmId.startsWith("bank:")) {
    const b = userBanks.find(x => "bank:" + x.id === pmId);
    return b ? { id: pmId, name: `🏦 ${b.name} (${BANK_TYPES[b.type] ?? b.type})`, acct: b.account_code } : undefined;
  }
  return PM_ASSET_ACCT.find(p => p.id === pmId);
}

function resolveEntry(
  scen: Scenario,
  pmId: string,
  ccCards: { id: string; name: string; account_code: string }[],
  userBanks: { id: string; name: string; type: string; account_code: string }[],
) {
  const pm = resolvePM(pmId, ccCards, userBanks);
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
  const { txns, ccCards, userBanks, userLiabs, userCreatedAt, addCCCard, addUserBank, addUserLiab, addTransaction, deleteTransaction, summary, loading } = useFinance();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", desc: "", scenId: "", pmId: "", amount: "" });
  // ob_bank
  const [bankName, setBankName] = useState("");
  const [bankType, setBankType] = useState("savings");
  // ob_cc / ob_bnpl
  const [cardName, setCardName] = useState("");
  // pay_cc / pay_bnpl — card selector for DR
  const [payCardId, setPayCardId] = useState("");
  // transfer_bank — destination account (DR)
  const [transferToId, setTransferToId] = useState("");
  // ob_liab — individual loan name + type
  const [loanName, setLoanName] = useState("");
  const [loanType, setLoanType] = useState("personal");
  // ob_asset sub-label
  const [subLabel, setSubLabel] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const scen = SCENARIOS.find(s => s.id === form.scenId);
  const isObBank    = form.scenId === "ob_bank";
  const isCardSetup = CARD_SETUP_SCENS.includes(form.scenId);
  const isDualPay   = DUAL_PM_SCENS.includes(form.scenId);
  const isTransfer  = TRANSFER_SCENS.includes(form.scenId);
  const isLiabSetup = LIAB_SETUP_SCENS.includes(form.scenId);
  const cardType    = form.scenId === "ob_bnpl" || form.scenId === "pay_bnpl" ? "bnpl" : "credit";
  const availablePayCards = ccCards.filter(c => c.card_type === cardType);

  const pmPool  = scen && !isObBank && !isCardSetup && !isLiabSetup ? getPMPool(scen, ccCards, userBanks) : [];
  const entry   = scen && !isObBank && !isCardSetup && !isDualPay && !isTransfer && !isLiabSetup
    ? resolveEntry(scen, form.pmId, ccCards, userBanks)
    : null;
  const needsPM = scen && scen.pmRole !== "none" && !isObBank && !isCardSetup && !isLiabSetup;

  const groups = useMemo(() => {
    const g: Record<string, Scenario[]> = {};
    SCENARIOS.forEach(s => { if (!g[s.group]) g[s.group] = []; g[s.group].push(s); });
    return g;
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleScenChange(newId: string) {
    const s = SCENARIOS.find(x => x.id === newId);
    setForm(p => ({
      ...p, scenId: newId, pmId: "",
      date: s?.group === "📂 Opening Balance" && userCreatedAt ? userCreatedAt : p.date,
    }));
    setBankName(""); setBankType("savings");
    setCardName(""); setPayCardId(""); setSubLabel("");
    setTransferToId(""); setLoanName(""); setLoanType("personal");
  }

  function resetForm() {
    setForm({ date: "", desc: "", scenId: "", pmId: "", amount: "" });
    setBankName(""); setBankType("savings");
    setCardName(""); setPayCardId(""); setSubLabel(""); setErr("");
    setTransferToId(""); setLoanName(""); setLoanType("personal");
  }

  async function submit() {
    if (!form.date || !form.amount) { setErr("กรุณากรอกวันที่และจำนวนเงิน"); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt < 0) { setErr("จำนวนเงินไม่ถูกต้อง"); return; }
    setSaving(true);

    // --- ob_bank ---
    if (isObBank) {
      if (!bankName.trim()) { setErr("กรุณาระบุชื่อธนาคาร/บัญชี"); setSaving(false); return; }
      const { bank, error: bankErr } = await addUserBank(bankName.trim(), bankType);
      if (bankErr || !bank) { setErr(bankErr?.message || "สร้างบัญชีไม่สำเร็จ"); setSaving(false); return; }
      const label = `${bank.name} (${BANK_TYPES[bank.type] ?? bank.type})`;
      if (amt > 0) {
        const { error } = await addTransaction({ date: form.date, description: form.desc || `ยอดเงิน${bank.name} เริ่มต้น`, dr_account: bank.account_code, cr_account: "3100", dr_name: label, cr_name: "Opening Equity", amount: amt, is_system: false });
        if (error) { setErr(error.message); setSaving(false); return; }
      }
      resetForm(); setOpen(false); setSaving(false); return;
    }

    // --- ob_cc / ob_bnpl ---
    if (isCardSetup) {
      if (!cardName.trim()) { setErr("กรุณาระบุชื่อบัตร/บัญชี"); setSaving(false); return; }
      const { card, error: cardErr } = await addCCCard({ name: cardName.trim(), card_type: cardType, bank_id: "" });
      if (cardErr || !card) { setErr(cardErr?.message || "สร้างบัตรไม่สำเร็จ"); setSaving(false); return; }
      if (amt > 0) {
        const label = `${cardType === "bnpl" ? "🛒" : "💳"} ${card.name}`;
        const { error } = await addTransaction({ date: form.date, description: form.desc || `หนี้${card.name} เริ่มต้น`, dr_account: "3100", cr_account: card.account_code, dr_name: "Opening Equity", cr_name: label, amount: amt, is_system: false });
        if (error) { setErr(error.message); setSaving(false); return; }
      }
      resetForm(); setOpen(false); setSaving(false); return;
    }

    // --- ob_liab: individual named loan ---
    if (isLiabSetup) {
      if (!loanName.trim()) { setErr("กรุณาระบุชื่อสินเชื่อ"); setSaving(false); return; }
      const { liab, error: liabErr } = await addUserLiab(loanName.trim(), loanType);
      if (liabErr || !liab) { setErr(liabErr?.message || "สร้างสินเชื่อไม่สำเร็จ"); setSaving(false); return; }
      if (amt > 0) {
        const { error } = await addTransaction({ date: form.date, description: form.desc || `หนี้${liab.name} เริ่มต้น`, dr_account: "3100", cr_account: liab.account_code, dr_name: "Opening Equity", cr_name: liab.name, amount: amt, is_system: false });
        if (error) { setErr(error.message); setSaving(false); return; }
      }
      resetForm(); setOpen(false); setSaving(false); return;
    }

    // --- transfer_bank (dual PM: both sides bank/cash) ---
    if (isTransfer) {
      const toAcct  = resolvePM(transferToId, ccCards, userBanks);
      const fromAcct = resolvePM(form.pmId, ccCards, userBanks);
      if (!toAcct)   { setErr("กรุณาเลือกบัญชีปลายทาง (รับเงิน)"); setSaving(false); return; }
      if (!fromAcct) { setErr("กรุณาเลือกบัญชีต้นทาง (หักออก)"); setSaving(false); return; }
      if (toAcct.id === fromAcct.id) { setErr("บัญชีต้นทางและปลายทางต้องไม่เหมือนกัน"); setSaving(false); return; }
      if (amt <= 0)  { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }
      const { error } = await addTransaction({ date: form.date, description: form.desc || `โอน ${fromAcct.name} → ${toAcct.name}`, dr_account: toAcct.acct, cr_account: fromAcct.acct, dr_name: toAcct.name, cr_name: fromAcct.name, amount: amt, is_system: false });
      if (error) setErr(error.message);
      else { resetForm(); setOpen(false); }
      setSaving(false); return;
    }

    // --- pay_cc / pay_bnpl (dual PM) ---
    if (isDualPay) {
      const card = ccCards.find(c => c.id === payCardId);
      const bank = resolvePM(form.pmId, ccCards, userBanks);
      if (!card) { setErr("กรุณาเลือกบัตรที่ต้องการชำระ"); setSaving(false); return; }
      if (!bank) { setErr("กรุณาเลือกบัญชีธนาคารที่โอนจ่าย"); setSaving(false); return; }
      if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }
      const { error } = await addTransaction({ date: form.date, description: form.desc || `ชำระ ${card.name}`, dr_account: card.account_code, cr_account: bank.acct, dr_name: `${cardType === "bnpl" ? "🛒" : "💳"} ${card.name}`, cr_name: bank.name, amount: amt, is_system: false });
      if (error) setErr(error.message);
      else { resetForm(); setOpen(false); }
      setSaving(false); return;
    }

    // --- Normal case ---
    if (!form.scenId) { setErr("กรุณาเลือกประเภทรายการ"); setSaving(false); return; }
    if (needsPM && !form.pmId) { setErr("กรุณาเลือก" + (scen?.pmLabel || "ช่องทาง")); setSaving(false); return; }
    if (!entry) { setErr("ไม่สามารถ generate Dr/Cr ได้"); setSaving(false); return; }
    if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }

    const descFinal  = form.desc ? (subLabel ? `${form.desc} — ${subLabel}` : form.desc) : (subLabel || scen?.label || "");
    const drNameFinal = subLabel && scen?.id === "ob_asset" ? `${entry.drName} (${subLabel})` : entry.drName;
    const crNameFinal = subLabel && scen?.id === "ob_liab"  ? `${entry.crName} (${subLabel})` : entry.crName;

    const { error } = await addTransaction({ date: form.date, description: descFinal, dr_account: entry.dr, cr_account: entry.cr, dr_name: drNameFinal, cr_name: crNameFinal, amount: amt, is_system: false });
    if (error) setErr(error.message);
    else { resetForm(); setOpen(false); }
    setSaving(false);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const dualPayCard = isDualPay ? ccCards.find(c => c.id === payCardId) : null;
  const dualPayBank = isDualPay ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const transferTo   = isTransfer ? resolvePM(transferToId, ccCards, userBanks) : null;
  const transferFrom = isTransfer ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const transferPool = isTransfer ? getPMPool(SCENARIOS.find(s => s.id === "transfer_bank")!, ccCards, userBanks) : [];
  // Balance of selected source account for display
  const xferBankCOA  = Object.fromEntries(userBanks.map(b => [b.account_code, { name: b.name, type: "asset" as const, normal: "debit" as const }]));
  const transferFromBal = transferFrom ? netBal(summary.balances, transferFrom.acct, xferBankCOA) : null;

  return (
    <AppShell netWorth={summary.totalEquity} netIncome={summary.netIncome} balanced={summary.balanced}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-medium text-white">📒 Journal</h1>
        <button onClick={() => setOpen(!open)} className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
          + บันทึกรายการ
        </button>
      </div>

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
              <select value={form.scenId} onChange={e => handleScenChange(e.target.value)}>
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

          {/* ob_bank: bank name + type */}
          {isObBank && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อธนาคาร / บัญชี</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="เช่น KBank, SCB, ธกส..." style={{ textAlign: "left" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ประเภทบัญชี</label>
                <select value={bankType} onChange={e => setBankType(e.target.value)}>
                  {Object.entries(BANK_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ob_cc / ob_bnpl: card name */}
          {isCardSetup && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>
                {cardType === "bnpl" ? "ชื่อบริการ BNPL / Pay Later" : "ชื่อบัตรเครดิต"}
              </label>
              <input type="text" value={cardName} onChange={e => setCardName(e.target.value)}
                placeholder={cardType === "bnpl" ? "เช่น Shopee S Pay Later, True Money Pay Next..." : "เช่น KBank Platinum, SCB Cashback..."}
                style={{ textAlign: "left" }} />
              <div className="mt-1.5 text-xs px-2 py-1.5 rounded" style={{ background: "#0a1628", color: "#60a5fa", borderLeft: "2px solid #3b82f6" }}>
                ยอดเงิน = 0 ได้ หากบัตร/บริการนี้ยังไม่มีหนี้สินตั้งต้น
              </div>
            </div>
          )}

          {/* ob_liab: loan type + individual name */}
          {isLiabSetup && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ประเภทสินเชื่อ</label>
                <select value={loanType} onChange={e => setLoanType(e.target.value)}>
                  <option value="home">🏠 สินเชื่อบ้าน</option>
                  <option value="car">🚗 สินเชื่อรถ</option>
                  <option value="personal">💼 เงินกู้ส่วนบุคคล</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อสินเชื่อ / ธนาคาร</label>
                <input type="text" value={loanName} onChange={e => setLoanName(e.target.value)}
                  placeholder={loanType === "home" ? "เช่น บ้านรังสิต — ออมสิน..." : loanType === "car" ? "เช่น Toyota Yaris — KBank..." : "เช่น สินเชื่อ SCB Easy..."}
                  style={{ textAlign: "left" }} />
              </div>
            </div>
          )}

          {/* pay_cc / pay_bnpl: card selector (DR) */}
          {isDualPay && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>
                {cardType === "bnpl" ? "บริการ BNPL ที่ชำระ" : "บัตรเครดิตที่ชำระ"}
              </label>
              {availablePayCards.length === 0 ? (
                <div className="text-xs px-3 py-2 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>
                  ยังไม่มี{cardType === "bnpl" ? "บริการ BNPL" : "บัตรเครดิต"} — บันทึกผ่าน Journal &gt; Opening Balance ก่อน
                </div>
              ) : (
                <select value={payCardId} onChange={e => setPayCardId(e.target.value)}>
                  <option value="">— เลือก{cardType === "bnpl" ? "บริการ BNPL" : "บัตรเครดิต"} —</option>
                  {availablePayCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* transfer_bank: source left, destination right */}
          {isTransfer && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีต้นทาง (หักออก) CR</label>
                <select value={form.pmId} onChange={e => set("pmId", e.target.value)}>
                  <option value="">— เลือก —</option>
                  {transferPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {transferFrom && transferFromBal !== null && (
                  <div className="mt-1 text-xs px-2 py-1 rounded" style={{ background: "#0a1628", color: "#60a5fa" }}>
                    คงเหลือ: <span className="font-medium">{THB(transferFromBal)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีปลายทาง (รับเงิน) DR</label>
                <select value={transferToId} onChange={e => setTransferToId(e.target.value)}>
                  <option value="">— เลือก —</option>
                  {transferPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Normal PM selector */}
          {!isObBank && !isCardSetup && !isLiabSetup && !isTransfer && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>
                {isDualPay ? "บัญชีธนาคารที่โอนจ่าย" : (scen?.pmLabel || "ช่องทาง")}{!needsPM && !isDualPay && " (ไม่จำเป็น)"}
              </label>
              <select value={form.pmId} onChange={e => set("pmId", e.target.value)}
                disabled={!needsPM && !isDualPay} style={{ opacity: (needsPM || isDualPay) ? 1 : 0.4 }}>
                <option value="">— เลือก —</option>
                {pmPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {(needsPM || isDualPay) && pmPool.length === 0 && (
                <div className="mt-1.5 text-xs px-2 py-1.5 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>
                  ยังไม่มีบัญชีธนาคาร — บันทึก &quot;ยอดเงินฝากธนาคารเริ่มต้น&quot; ก่อน
                </div>
              )}
            </div>
          )}

          {/* Sub-label for ob_asset only */}
          {scen?.id === "ob_asset" && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อ/รายละเอียดสินทรัพย์ (ไม่บังคับ)</label>
              <input type="text" value={subLabel} onChange={e => setSubLabel(e.target.value)}
                placeholder="เช่น Toyota Fortuner, บ้านสุขุมวิท..."
                style={{ textAlign: "left" }} />
            </div>
          )}

          {/* Preview: ob_bank */}
          {isObBank && bankName.trim() && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<><span className="font-bold text-xs mr-1" style={{ color: "#60a5fa" }}>11xx</span><span className="text-xs" style={{ color: "#93c5fd" }}>{bankName} ({BANK_TYPES[bankType]})</span></>}
              cr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>3100</span><span className="text-xs" style={{ color: "#fca5a5" }}>Opening Equity</span></>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: ob_cc / ob_bnpl */}
          {isCardSetup && cardName.trim() && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>3100</span><span className="text-xs" style={{ color: "#fca5a5" }}>Opening Equity</span></>}
              cr={<><span className="font-bold text-xs mr-1" style={{ color: "#f87171" }}>21xx</span><span className="text-xs" style={{ color: "#fca5a5" }}>{cardType === "bnpl" ? "🛒" : "💳"} {cardName}</span></>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: ob_liab */}
          {isLiabSetup && loanName.trim() && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>3100</span><span className="text-xs" style={{ color: "#fca5a5" }}>Opening Equity</span></>}
              cr={<><span className="font-bold text-xs mr-1" style={{ color: "#f87171" }}>22xx</span><span className="text-xs" style={{ color: "#fca5a5" }}>{loanName}</span></>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: transfer_bank */}
          {isTransfer && transferTo && transferFrom && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>{transferTo.acct}</span><span className="text-xs" style={{ color: "#93c5fd" }}>{transferTo.name}</span></>}
              cr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>{transferFrom.acct}</span><span className="text-xs" style={{ color: "#fca5a5" }}>{transferFrom.name}</span></>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: pay_cc / pay_bnpl */}
          {isDualPay && dualPayCard && dualPayBank && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>{dualPayCard.account_code}</span><span className="text-xs" style={{ color: "#93c5fd" }}>{dualPayCard.name}</span></>}
              cr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>{dualPayBank.acct}</span><span className="text-xs" style={{ color: "#fca5a5" }}>{dualPayBank.name}</span></>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: normal entries */}
          {!isObBank && !isCardSetup && !isDualPay && !isTransfer && !isLiabSetup && entry && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#1e3a5f", color: "#60a5fa" }}>{entry.dr}</span><span className="text-xs" style={{ color: "#93c5fd" }}>{entry.drName}</span></>}
              cr={<><span className="inline-block px-2 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#3f1515", color: "#f87171" }}>{entry.cr}</span><span className="text-xs" style={{ color: "#fca5a5" }}>{entry.crName}</span></>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {err && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{err}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#2563eb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>
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
              <tr>{["วันที่","รายการ","Dr","Cr","฿",""].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium" style={{ color: "#455672", borderBottom: "0.5px solid #16243a" }}>{h}</th>
              ))}</tr>
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

function PreviewRow({ dr, cr, amt }: { dr: React.ReactNode; cr: React.ReactNode; amt: number }) {
  return (
    <div className="mb-3 rounded-lg overflow-hidden" style={{ border: "0.5px solid #16243a" }}>
      <div className="flex">
        <div className="flex-1 px-3 py-2" style={{ background: "#0a1628" }}>
          <div className="text-xs mb-1" style={{ color: "#455672" }}>DEBIT</div>
          {dr}
        </div>
        <div className="flex-1 px-3 py-2" style={{ background: "#160a0a" }}>
          <div className="text-xs mb-1" style={{ color: "#455672" }}>CREDIT</div>
          {cr}
        </div>
        <div className="px-3 py-2 flex items-center" style={{ background: "#0a160a" }}>
          <span className="text-sm font-medium" style={{ color: "#4ade80" }}>{THB(amt)}</span>
        </div>
      </div>
    </div>
  );
}
