"use client";
import React, { useState, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { THB, fmt, COA, netBal } from "@/lib/balance";
import { SCENARIOS, PM_ASSET_ACCT, type Scenario } from "@/lib/scenarios";

const BANK_TYPES: Record<string, string> = {
  savings: "ออมทรัพย์", fixed: "ฝากประจำ", current: "กระแสรายวัน", other: "อื่นๆ",
};

const DUAL_PM_SCENS    = ["pay_cc", "pay_bnpl"];
const CARD_SETUP_SCENS = ["ob_cc", "ob_bnpl"];
const TRANSFER_SCENS   = ["transfer_bank"];
const LIAB_SETUP_SCENS = ["ob_liab"];
const LIAB_PAY_SCENS   = ["pay_loan", "pay_home", "pay_car", "pay_welfare_coop", "pay_welfare_home", "pay_welfare_car", "pay_welfare_other"];
const LIAB_PAY_TYPE: Record<string, string> = {
  pay_loan: "personal", pay_home: "home", pay_car: "car",
  pay_welfare_coop: "welfare_coop", pay_welfare_home: "welfare_home",
  pay_welfare_car: "welfare_car", pay_welfare_other: "welfare_other",
};
const CASH_ADV_CC_SCENS   = ["cash_adv_cc"];
const CASH_ADV_BNPL_SCENS = ["cash_adv_bnpl"];
const CASH_ADV_LOAN_SCENS = ["cash_adv_loan"];
const SALARY_SCENS        = ["salary"];

interface LoanDeductRow { id: string; loanId: string; amount: string }

function getPMPool(
  s: Scenario,
  ccCards: { id: string; name: string; card_type: string; account_code: string }[],
  userBanks: { id: string; name: string; type: string; account_code: string }[],
  userLiabs: { id: string; name: string; type: string; account_code: string }[] = [],
) {
  const cashPM = [{ id: "cash:1110", name: "💵 เงินสด", acct: "1110" }];
  const bankPM = userBanks.map(b => ({ id: "bank:" + b.id, name: `🏦 ${b.name} (${BANK_TYPES[b.type] ?? b.type})`, acct: b.account_code }));
  const ccPM   = ccCards.map(c => ({ id: "cc:" + c.id, name: `${c.card_type === "bnpl" ? "🛒" : "💳"} ${c.name}`, acct: c.account_code }));

  if (s.pmRole === "receive")     return [...cashPM, ...bankPM];
  if (s.pmRole === "asset_acct")  return PM_ASSET_ACCT;
  if (DUAL_PM_SCENS.includes(s.id)) return bankPM;
  if (TRANSFER_SCENS.includes(s.id)) return [...cashPM, ...bankPM];
  if (s.pmRole === "liab_cr") {
    const loanEmoji: Record<string, string> = { home: "🏠", car: "🚗", personal: "💼" };
    const liabPM = userLiabs.map(l => ({ id: "ul:" + l.id, name: `${loanEmoji[l.type] ?? "💼"} ${l.name}`, acct: l.account_code }));
    return [...ccPM, ...liabPM];
  }
  if (s.pmRole === "pay") return [...cashPM, ...bankPM, ...ccPM];
  return [];
}

function resolvePM(
  pmId: string,
  ccCards: { id: string; name: string; card_type?: string; account_code: string }[],
  userBanks: { id: string; name: string; type: string; account_code: string }[],
  userLiabs: { id: string; name: string; type: string; account_code: string }[] = [],
) {
  if (pmId === "cash:1110") return { id: "cash:1110", name: "💵 เงินสด", acct: "1110" };
  if (pmId.startsWith("cc:")) {
    const c = ccCards.find(x => "cc:" + x.id === pmId);
    return c ? { id: pmId, name: `${c.card_type === "bnpl" ? "🛒" : "💳"} ${c.name}`, acct: c.account_code } : undefined;
  }
  if (pmId.startsWith("bank:")) {
    const b = userBanks.find(x => "bank:" + x.id === pmId);
    return b ? { id: pmId, name: `🏦 ${b.name} (${BANK_TYPES[b.type] ?? b.type})`, acct: b.account_code } : undefined;
  }
  if (pmId.startsWith("ul:")) {
    const loanEmoji: Record<string, string> = { home: "🏠", car: "🚗", personal: "💼" };
    const l = userLiabs.find(x => "ul:" + x.id === pmId);
    return l ? { id: pmId, name: `${loanEmoji[l.type] ?? "💼"} ${l.name}`, acct: l.account_code } : undefined;
  }
  return PM_ASSET_ACCT.find(p => p.id === pmId);
}

function resolveEntry(
  scen: Scenario,
  pmId: string,
  ccCards: { id: string; name: string; account_code: string }[],
  userBanks: { id: string; name: string; type: string; account_code: string }[],
  userLiabs: { id: string; name: string; type: string; account_code: string }[] = [],
) {
  const pm = resolvePM(pmId, ccCards, userBanks, userLiabs);
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
  const { txns, ccCards, userBanks, userLiabs, userCreatedAt, addCCCard, addUserBank, addUserLiab, addTransaction, updateTransaction, deleteTransaction, summary, loading } = useFinance();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", desc: "", amount: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [filterAcct, setFilterAcct] = useState<string>("");
  const [filterSide, setFilterSide] = useState<"all" | "dr" | "cr">("all");
  const [form, setForm] = useState({ date: "", desc: "", scenId: "", pmId: "", amount: "" });
  // ob_bank
  const [bankName, setBankName] = useState("");
  const [bankType, setBankType] = useState("savings");
  // ob_cc / ob_bnpl
  const [cardName, setCardName] = useState("");
  // pay_cc / pay_bnpl — card selector for DR
  const [payCardId, setPayCardId] = useState("");
  // pay_loan / pay_home / pay_car — individual loan selector for DR
  const [payLoanId, setPayLoanId] = useState("");
  // transfer_bank — destination account (DR)
  const [transferToId, setTransferToId] = useState("");
  // ob_liab — individual loan name + type
  const [loanName, setLoanName] = useState("");
  const [loanType, setLoanType] = useState("personal");
  // ob_asset sub-label
  const [subLabel, setSubLabel] = useState("");
  // exp_insurance savings-type toggle
  const [insIsAsset, setInsIsAsset] = useState(false);
  // canBeAsset expense toggle (fashion, entertain, edu, home)
  const [expIsAsset, setExpIsAsset] = useState(false);
  const [expAssetAcct, setExpAssetAcct] = useState("1350");
  // salary compound form
  const [salForm, setSalForm] = useState({
    base: "", ot: "", allow_fuel: "", allow_phone: "", allow_pos: "", bonus: "",
    tax: "", ss_emp: "", pvd_emp: "",
    ss_er: "", pvd_er: "",
  });
  const [salLoans, setSalLoans] = useState<LoanDeductRow[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const scen = SCENARIOS.find(s => s.id === form.scenId);
  const isObBank      = form.scenId === "ob_bank";
  const isCardSetup   = CARD_SETUP_SCENS.includes(form.scenId);
  const isDualPay     = DUAL_PM_SCENS.includes(form.scenId);
  const isTransfer    = TRANSFER_SCENS.includes(form.scenId);
  const isLiabSetup   = LIAB_SETUP_SCENS.includes(form.scenId);
  const isLiabPay     = LIAB_PAY_SCENS.includes(form.scenId);
  const isCashAdvCC   = CASH_ADV_CC_SCENS.includes(form.scenId);
  const isCashAdvBNPL = CASH_ADV_BNPL_SCENS.includes(form.scenId);
  const isCashAdvLoan = CASH_ADV_LOAN_SCENS.includes(form.scenId);
  const isSalary      = SALARY_SCENS.includes(form.scenId);
  const cardType      = form.scenId === "ob_bnpl" || form.scenId === "pay_bnpl" ? "bnpl" : "credit";
  const availablePayCards = ccCards.filter(c => c.card_type === cardType);
  const availablePayLoans = userLiabs.filter(l => l.type === (LIAB_PAY_TYPE[form.scenId] ?? ""));
  const advCreditCards    = ccCards.filter(c => c.card_type === "credit");
  const advBNPLCards      = ccCards.filter(c => c.card_type === "bnpl");

  const pmPool  = scen && !isObBank && !isCardSetup && !isLiabSetup && !isCashAdvCC && !isCashAdvBNPL && !isCashAdvLoan && !isSalary
    ? getPMPool(scen, ccCards, userBanks, userLiabs) : [];
  const entry   = scen && !isObBank && !isCardSetup && !isDualPay && !isTransfer && !isLiabSetup && !isCashAdvCC && !isCashAdvBNPL && !isCashAdvLoan && !isSalary
    ? resolveEntry(scen, form.pmId, ccCards, userBanks, userLiabs)
    : null;
  const needsPM = scen && scen.pmRole !== "none" && !isObBank && !isCardSetup && !isLiabSetup && !isCashAdvCC && !isCashAdvBNPL && !isCashAdvLoan && !isSalary;

  // ── Salary placeholder: dig last salary's components (bank=net, 5030=tax, 1240=SS, 1230=PVD) ──
  const lastSalary = useMemo(() => {
    const salTxns = txns.filter(t => t.cr_account === "4100" || t.cr_account === "4150" || t.cr_account === "2310");
    if (salTxns.length === 0) return null;
    const lastDate = salTxns[salTxns.length - 1].date;
    const sameDay = salTxns.filter(t => t.date === lastDate);
    const by: Record<string, number> = {};
    sameDay.forEach(t => { by[t.dr_account] = (by[t.dr_account] || 0) + t.amount; });
    const grossCR = sameDay.filter(t => t.cr_account === "4100").reduce((s, t) => s + t.amount, 0);
    const er4150  = sameDay.filter(t => t.cr_account === "4150").reduce((s, t) => s + t.amount, 0);
    const er2310  = sameDay.filter(t => t.cr_account === "2310").reduce((s, t) => s + t.amount, 0);
    const tax = by["5030"] || 0;
    // SS-employee = whatever debits 1240 with cr=4100; SS-employer = whatever debits 1240 with cr=4150
    const ssEmpRow = sameDay.filter(t => t.dr_account === "1240" && t.cr_account === "4100").reduce((s, t) => s + t.amount, 0);
    const ssErRow  = sameDay.filter(t => t.dr_account === "1240" && t.cr_account === "4150").reduce((s, t) => s + t.amount, 0);
    const pvdEmpRow = sameDay.filter(t => t.dr_account === "1230" && t.cr_account === "4100").reduce((s, t) => s + t.amount, 0);
    const pvdErRow  = sameDay.filter(t => t.dr_account === "1230" && t.cr_account === "2310").reduce((s, t) => s + t.amount, 0);
    return {
      date: lastDate, gross: grossCR,
      tax, ss_emp: ssEmpRow, pvd_emp: pvdEmpRow,
      ss_er: ssErRow || er4150, pvd_er: pvdErRow || er2310,
    };
  }, [txns]);

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
    setCardName(""); setPayCardId(""); setPayLoanId(""); setSubLabel(""); setInsIsAsset(false); setExpIsAsset(false); setExpAssetAcct("1350");
    setTransferToId(""); setLoanName(""); setLoanType("personal");
    setSalForm({ base: "", ot: "", allow_fuel: "", allow_phone: "", allow_pos: "", bonus: "", tax: "", ss_emp: "", pvd_emp: "", ss_er: "", pvd_er: "" });
    setSalLoans([]);
  }

  function resetForm() {
    setForm({ date: "", desc: "", scenId: "", pmId: "", amount: "" });
    setBankName(""); setBankType("savings");
    setCardName(""); setPayCardId(""); setPayLoanId(""); setSubLabel(""); setInsIsAsset(false); setExpIsAsset(false); setExpAssetAcct("1350"); setErr("");
    setTransferToId(""); setLoanName(""); setLoanType("personal");
    setSalForm({ base: "", ot: "", allow_fuel: "", allow_phone: "", allow_pos: "", bonus: "", tax: "", ss_emp: "", pvd_emp: "", ss_er: "", pvd_er: "" });
    setSalLoans([]);
  }

  async function submit() {
    if (!form.date) { setErr("กรุณากรอกวันที่"); return; }
    if (!isSalary && !form.amount) { setErr("กรุณากรอกจำนวนเงิน"); return; }
    const amt = isSalary ? 0 : parseFloat(form.amount);
    if (!isSalary && (isNaN(amt) || amt < 0)) { setErr("จำนวนเงินไม่ถูกต้อง"); return; }
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

    // --- cash_adv_cc: DR bank/cash, CR credit card ---
    if (isCashAdvCC) {
      const card = advCreditCards.find(c => c.id === payCardId);
      const bank = resolvePM(form.pmId, ccCards, userBanks);
      if (!card) { setErr("กรุณาเลือกบัตรเครดิตที่เบิกเงิน"); setSaving(false); return; }
      if (!bank) { setErr("กรุณาเลือกบัญชีที่รับเงิน"); setSaving(false); return; }
      if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }
      const { error } = await addTransaction({ date: form.date, description: form.desc || `เบิกเงินสด ${card.name}`, dr_account: bank.acct, cr_account: card.account_code, dr_name: bank.name, cr_name: `💳 ${card.name}`, amount: amt, is_system: false });
      if (error) setErr(error.message);
      else { resetForm(); setOpen(false); }
      setSaving(false); return;
    }

    // --- cash_adv_bnpl: DR bank/cash, CR BNPL card ---
    if (isCashAdvBNPL) {
      const card = advBNPLCards.find(c => c.id === payCardId);
      const bank = resolvePM(form.pmId, ccCards, userBanks);
      if (!card) { setErr("กรุณาเลือกบัญชี BNPL ที่เบิกเงิน"); setSaving(false); return; }
      if (!bank) { setErr("กรุณาเลือกบัญชีที่รับเงิน"); setSaving(false); return; }
      if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }
      const { error } = await addTransaction({ date: form.date, description: form.desc || `เบิกเงินสด ${card.name}`, dr_account: bank.acct, cr_account: card.account_code, dr_name: bank.name, cr_name: `🛒 ${card.name}`, amount: amt, is_system: false });
      if (error) setErr(error.message);
      else { resetForm(); setOpen(false); }
      setSaving(false); return;
    }

    // --- cash_adv_loan: DR bank/cash, CR loan ---
    if (isCashAdvLoan) {
      const loan = userLiabs.find(l => l.id === payLoanId);
      const bank = resolvePM(form.pmId, ccCards, userBanks);
      if (!loan) { setErr("กรุณาเลือกสินเชื่อที่รับวงเงิน"); setSaving(false); return; }
      if (!bank) { setErr("กรุณาเลือกบัญชีที่รับเงิน"); setSaving(false); return; }
      if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }
      const loanEmoji: Record<string, string> = { home: "🏠", car: "🚗", personal: "💼" };
      const { error } = await addTransaction({ date: form.date, description: form.desc || `รับเงินกู้ ${loan.name}`, dr_account: bank.acct, cr_account: loan.account_code, dr_name: bank.name, cr_name: `${loanEmoji[loan.type] ?? "💼"} ${loan.name}`, amount: amt, is_system: false });
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

    // --- pay_loan / pay_home / pay_car with individual loan selected ---
    if (isLiabPay && payLoanId) {
      const loan = userLiabs.find(l => l.id === payLoanId);
      const bank = resolvePM(form.pmId, ccCards, userBanks);
      if (!loan) { setErr("ไม่พบสินเชื่อที่เลือก"); setSaving(false); return; }
      if (!bank) { setErr("กรุณาเลือกบัญชีธนาคารที่โอนจ่าย"); setSaving(false); return; }
      if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }
      const { error } = await addTransaction({
        date: form.date, description: form.desc || `ผ่อน ${loan.name}`,
        dr_account: loan.account_code, cr_account: bank.acct,
        dr_name: loan.name, cr_name: bank.name, amount: amt, is_system: false,
      });
      if (error) setErr(error.message);
      else { resetForm(); setOpen(false); }
      setSaving(false); return;
    }

    // --- salary: compound entry (gross + deductions + employer match) ---
    if (isSalary) {
      const bank = resolvePM(form.pmId, ccCards, userBanks);
      if (!bank) { setErr("กรุณาเลือกบัญชีที่รับเงินเดือน"); setSaving(false); return; }
      const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
      const base       = num(salForm.base);
      const ot         = num(salForm.ot);
      const allow_fuel = num(salForm.allow_fuel);
      const allow_phone= num(salForm.allow_phone);
      const allow_pos  = num(salForm.allow_pos);
      const bonus      = num(salForm.bonus);
      const tax        = num(salForm.tax);
      const ss_emp     = num(salForm.ss_emp);
      const pvd_emp    = num(salForm.pvd_emp);
      const ss_er      = num(salForm.ss_er);
      const pvd_er     = num(salForm.pvd_er);
      const gross      = base + ot + allow_fuel + allow_phone + allow_pos + bonus;
      if (gross <= 0) { setErr("กรอกเงินเดือน/รายได้รวมต้องมากกว่า 0"); setSaving(false); return; }
      const loanRows = salLoans
        .map(r => ({ ...r, amt: num(r.amount) }))
        .filter(r => r.loanId && r.amt > 0);
      // resolve loan account info
      const allLiabPool = [
        ...userLiabs.map(l => ({ id: "ul:" + l.id, name: l.name, acct: l.account_code })),
        ...ccCards.map(c => ({ id: "cc:" + c.id, name: `${c.card_type === "bnpl" ? "🛒" : "💳"} ${c.name}`, acct: c.account_code })),
      ];
      for (const lr of loanRows) {
        if (!allLiabPool.find(p => p.id === lr.loanId)) {
          setErr("รายการหักหนี้สินไม่ถูกต้อง"); setSaving(false); return;
        }
      }
      const totalLoanDeduct = loanRows.reduce((s, r) => s + r.amt, 0);
      const totalDeduct = tax + ss_emp + pvd_emp + totalLoanDeduct;
      if (totalDeduct > gross) { setErr("รายการหักรวมมากกว่ารายได้รวม"); setSaving(false); return; }
      const net = gross - totalDeduct;
      const ymLabel = form.date ? form.date.slice(0, 7) : "";
      const baseDesc = form.desc || `เงินเดือน ${ymLabel}`;
      const post = async (dr: string, drName: string, cr: string, crName: string, amount: number, suffix: string) => {
        if (amount <= 0) return null;
        return addTransaction({
          date: form.date, description: `${baseDesc} — ${suffix}`,
          dr_account: dr, cr_account: cr, dr_name: drName, cr_name: crName, amount, is_system: false,
        });
      };
      // Employee side — all CR 4100 (gross salary income)
      const r1 = await post(bank.acct, bank.name, "4100", "เงินเดือน", net, "เงินเข้าบัญชี (net)");
      if (r1?.error) { setErr(r1.error.message); setSaving(false); return; }
      const r2 = await post("5030", "ภาษีเงินได้บุคคลธรรมดา", "4100", "เงินเดือน", tax, "ภาษีหัก ณ ที่จ่าย");
      if (r2?.error) { setErr(r2.error.message); setSaving(false); return; }
      const r3 = await post("1240", "ประกันสังคม-สะสม", "4100", "เงินเดือน", ss_emp, "ประกันสังคม-ลูกจ้าง");
      if (r3?.error) { setErr(r3.error.message); setSaving(false); return; }
      const r4 = await post("1230", "กองทุนสำรองเลี้ยงชีพ (PVD)", "4100", "เงินเดือน", pvd_emp, "PVD-ลูกจ้าง");
      if (r4?.error) { setErr(r4.error.message); setSaving(false); return; }
      for (const lr of loanRows) {
        const loan = allLiabPool.find(p => p.id === lr.loanId)!;
        const r = await post(loan.acct, loan.name, "4100", "เงินเดือน", lr.amt, `หักชำระ ${loan.name}`);
        if (r?.error) { setErr(r.error.message); setSaving(false); return; }
      }
      // Employer match — separate entries
      const r5 = await post("1240", "ประกันสังคม-สะสม", "4150", "รายได้สมทบจากนายจ้าง", ss_er, "ประกันสังคม-นายจ้างสมทบ");
      if (r5?.error) { setErr(r5.error.message); setSaving(false); return; }
      const r6 = await post("1230", "กองทุนสำรองเลี้ยงชีพ (PVD)", "2310", "รายได้ PVD รอการรับรู้", pvd_er, "PVD-นายจ้างสมทบ");
      if (r6?.error) { setErr(r6.error.message); setSaving(false); return; }
      resetForm(); setOpen(false); setSaving(false); return;
    }

    // --- Normal case ---
    if (!form.scenId) { setErr("กรุณาเลือกประเภทรายการ"); setSaving(false); return; }
    if (needsPM && !form.pmId) { setErr("กรุณาเลือก" + (scen?.pmLabel || "ช่องทาง")); setSaving(false); return; }
    if (!entry) { setErr("ไม่สามารถ generate Dr/Cr ได้"); setSaving(false); return; }
    if (amt <= 0) { setErr("จำนวนเงินต้องมากกว่า 0"); setSaving(false); return; }

    const descFinal  = form.desc ? (subLabel ? `${form.desc} — ${subLabel}` : form.desc) : (subLabel || scen?.label || "");
    const drNameFinal = subLabel && scen?.id === "ob_asset" ? `${entry.drName} (${subLabel})` : entry.drName;
    const crNameFinal = subLabel && scen?.id === "ob_liab"  ? `${entry.crName} (${subLabel})` : entry.crName;

    const isInsAsset = form.scenId === "exp_insurance" && insIsAsset;
    const isExpAsset = scen?.canBeAsset && expIsAsset;
    const drAcct  = isInsAsset ? "1150" : isExpAsset ? expAssetAcct : entry.dr;
    const drName  = isInsAsset ? "ค่าใช้จ่ายล่วงหน้า (ประกันสะสมทรัพย์)" : isExpAsset ? (COA[expAssetAcct]?.name ?? expAssetAcct) : drNameFinal;

    const { error } = await addTransaction({ date: form.date, description: descFinal, dr_account: drAcct, cr_account: entry.cr, dr_name: drName, cr_name: crNameFinal, amount: amt, is_system: false });
    if (error) setErr(error.message);
    else { resetForm(); setOpen(false); }
    setSaving(false);
  }

  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const acctNameOf = (code: string): string => {
    if (COA[code]) return COA[code].name;
    const b = userBanks.find(x => x.account_code === code);
    if (b) return `${b.name} (${BANK_TYPES[b.type] ?? b.type})`;
    const c = ccCards.find(x => x.account_code === code);
    if (c) return `${c.card_type === "bnpl" ? "🛒" : "💳"} ${c.name}`;
    const l = userLiabs.find(x => x.account_code === code);
    if (l) return l.name;
    return code;
  };
  const acctCodesInUse = Array.from(new Set(txns.flatMap(t => [t.dr_account, t.cr_account]))).sort();
  const filteredTxns = filterAcct
    ? txns.filter(t => {
        if (filterSide === "dr") return t.dr_account === filterAcct;
        if (filterSide === "cr") return t.cr_account === filterAcct;
        return t.dr_account === filterAcct || t.cr_account === filterAcct;
      })
    : txns;

  const dualPayCard = isDualPay ? ccCards.find(c => c.id === payCardId) : null;
  const dualPayBank = isDualPay ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const advCCCard   = isCashAdvCC   ? advCreditCards.find(c => c.id === payCardId) : null;
  const advCCBank   = isCashAdvCC   ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const advBNPLCard = isCashAdvBNPL ? advBNPLCards.find(c => c.id === payCardId) : null;
  const advBNPLBank = isCashAdvBNPL ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const advLoanItem = isCashAdvLoan ? userLiabs.find(l => l.id === payLoanId) : null;
  const advLoanBank = isCashAdvLoan ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const cashAdvPool = (isCashAdvCC || isCashAdvBNPL || isCashAdvLoan)
    ? [{ id: "cash:1110", name: "💵 เงินสด", acct: "1110" }, ...userBanks.map(b => ({ id: "bank:" + b.id, name: `🏦 ${b.name} (${BANK_TYPES[b.type] ?? b.type})`, acct: b.account_code }))]
    : [];
  const salaryBankPool = isSalary
    ? [{ id: "cash:1110", name: "💵 เงินสด", acct: "1110" }, ...userBanks.map(b => ({ id: "bank:" + b.id, name: `🏦 ${b.name} (${BANK_TYPES[b.type] ?? b.type})`, acct: b.account_code }))]
    : [];
  const salaryLoanPool = isSalary
    ? [
        ...userLiabs.map(l => {
          const emo: Record<string, string> = { home: "🏠", car: "🚗", personal: "💼", welfare_coop: "🤝", welfare_home: "🏡", welfare_car: "🚙", welfare_other: "📋" };
          return { id: "ul:" + l.id, name: `${emo[l.type] ?? "💼"} ${l.name}`, acct: l.account_code };
        }),
        ...ccCards.map(c => ({ id: "cc:" + c.id, name: `${c.card_type === "bnpl" ? "🛒" : "💳"} ${c.name}`, acct: c.account_code })),
      ]
    : [];
  const salNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
  const salGross = isSalary ? (salNum(salForm.base) + salNum(salForm.ot) + salNum(salForm.allow_fuel) + salNum(salForm.allow_phone) + salNum(salForm.allow_pos) + salNum(salForm.bonus)) : 0;
  const salDeduct = isSalary ? (salNum(salForm.tax) + salNum(salForm.ss_emp) + salNum(salForm.pvd_emp) + salLoans.reduce((s, r) => s + salNum(r.amount), 0)) : 0;
  const salNet = salGross - salDeduct;
  const setSal = (k: keyof typeof salForm, v: string) => setSalForm(p => ({ ...p, [k]: v }));
  const phStr = (n: number) => n > 0 ? n.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : "";
  const selectedPayLoan = isLiabPay && payLoanId ? userLiabs.find(l => l.id === payLoanId) : null;
  const liabPayBank = isLiabPay && form.pmId ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const transferTo   = isTransfer ? resolvePM(transferToId, ccCards, userBanks) : null;
  const transferFrom = isTransfer ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const transferPool = isTransfer ? getPMPool(SCENARIOS.find(s => s.id === "transfer_bank")!, ccCards, userBanks) : [];
  // Balance of selected source account for display
  const pmBankCOA       = Object.fromEntries(userBanks.map(b => [b.account_code, { name: b.name, type: "asset" as const, normal: "debit" as const }]));
  const transferFromBal = transferFrom ? netBal(summary.balances, transferFrom.acct, pmBankCOA) : null;
  // Show balance for any bank/cash PM selection in normal PM selector
  const selectedNormalPM = (!isObBank && !isCardSetup && !isLiabSetup && !isTransfer && form.pmId)
    ? resolvePM(form.pmId, ccCards, userBanks) : null;
  const selectedNormalPMBal = selectedNormalPM && (selectedNormalPM.acct === "1110" || selectedNormalPM.id.startsWith("bank:"))
    ? netBal(summary.balances, selectedNormalPM.acct, pmBankCOA)
    : null;

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

          <div className={`grid ${isSalary ? "grid-cols-1" : "grid-cols-2"} gap-3 mb-3`}>
            {!isSalary && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>จำนวน ฿</label>
                <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" min="0" />
              </div>
            )}
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
                  <option value="welfare_coop">🤝 เงินกู้สวัสดิการ-สหกรณ์ออมทรัพย์</option>
                  <option value="welfare_home">🏡 เงินกู้สวัสดิการบ้าน (จากบริษัท)</option>
                  <option value="welfare_car">🚙 เงินกู้สวัสดิการรถ (จากบริษัท)</option>
                  <option value="welfare_other">📋 เงินกู้สวัสดิการอื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>ชื่อสินเชื่อ / ธนาคาร</label>
                <input type="text" value={loanName} onChange={e => setLoanName(e.target.value)}
                  placeholder={
                    loanType === "home"          ? "เช่น บ้านรังสิต — ออมสิน..." :
                    loanType === "car"           ? "เช่น Toyota Yaris — KBank..." :
                    loanType === "welfare_coop"  ? "เช่น สหกรณ์ออมทรัพย์ ปตท..." :
                    loanType === "welfare_home"  ? "เช่น สวัสดิการบ้านบริษัท ABC..." :
                    loanType === "welfare_car"   ? "เช่น สวัสดิการรถบริษัท ABC..." :
                    loanType === "welfare_other" ? "เช่น เงินกู้ฉุกเฉิน บริษัท..." :
                    "เช่น สินเชื่อ SCB Easy..."
                  }
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

          {/* pay_loan / pay_home / pay_car: individual loan selector (DR) */}
          {isLiabPay && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>
                {form.scenId === "pay_home" ? "สินเชื่อบ้านที่ผ่อน" : form.scenId === "pay_car" ? "สินเชื่อรถที่ผ่อน" : "สินเชื่อที่ชำระ"}
              </label>
              {availablePayLoans.length === 0 ? (
                <div className="text-xs px-3 py-2 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>
                  ยังไม่มีสินเชื่อในประเภทนี้ — บันทึกผ่าน Journal &gt; Opening Balance ก่อน
                </div>
              ) : (
                <select value={payLoanId} onChange={e => setPayLoanId(e.target.value)}>
                  <option value="">— เลือกสินเชื่อ —</option>
                  {availablePayLoans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
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

          {/* cash_adv_cc: card selector (CR) + bank selector (DR) */}
          {isCashAdvCC && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัตรเครดิตที่เบิกเงิน (CR)</label>
                {advCreditCards.length === 0 ? (
                  <div className="text-xs px-3 py-2 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>ยังไม่มีบัตรเครดิต — บันทึกผ่าน Opening Balance ก่อน</div>
                ) : (
                  <select value={payCardId} onChange={e => setPayCardId(e.target.value)}>
                    <option value="">— เลือกบัตรเครดิต —</option>
                    {advCreditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีที่รับเงิน (DR)</label>
                <select value={form.pmId} onChange={e => set("pmId", e.target.value)}>
                  <option value="">— เลือกบัญชี —</option>
                  {cashAdvPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* cash_adv_bnpl: BNPL card selector (CR) + bank selector (DR) */}
          {isCashAdvBNPL && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชี BNPL ที่เบิกเงิน (CR)</label>
                {advBNPLCards.length === 0 ? (
                  <div className="text-xs px-3 py-2 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>ยังไม่มีบัญชี BNPL — บันทึกผ่าน Opening Balance ก่อน</div>
                ) : (
                  <select value={payCardId} onChange={e => setPayCardId(e.target.value)}>
                    <option value="">— เลือกบัญชี BNPL —</option>
                    {advBNPLCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีที่รับเงิน (DR)</label>
                <select value={form.pmId} onChange={e => set("pmId", e.target.value)}>
                  <option value="">— เลือกบัญชี —</option>
                  {cashAdvPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* cash_adv_loan: loan selector (CR) + bank selector (DR) */}
          {isCashAdvLoan && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>สินเชื่อที่รับวงเงิน (CR)</label>
                {userLiabs.length === 0 ? (
                  <div className="text-xs px-3 py-2 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>ยังไม่มีสินเชื่อ — บันทึกผ่าน Opening Balance ก่อน</div>
                ) : (
                  <select value={payLoanId} onChange={e => setPayLoanId(e.target.value)}>
                    <option value="">— เลือกสินเชื่อ —</option>
                    {userLiabs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีที่รับเงิน (DR)</label>
                <select value={form.pmId} onChange={e => set("pmId", e.target.value)}>
                  <option value="">— เลือกบัญชี —</option>
                  {cashAdvPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Salary compound form */}
          {isSalary && (
            <div className="mb-3 rounded-lg p-3" style={{ background: "#0a1628", border: "0.5px solid #1e3050" }}>
              <p className="text-xs font-medium mb-3" style={{ color: "#86efac" }}>📥 รายได้ (Earnings) — ลง CR เงินเดือน 4100</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>เงินเดือนพื้นฐาน *</label>
                  <input type="number" value={salForm.base} onChange={e => setSal("base", e.target.value)} placeholder={phStr(lastSalary?.gross || 0) || "0.00"} min="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>OT</label>
                  <input type="number" value={salForm.ot} onChange={e => setSal("ot", e.target.value)} placeholder="0.00" min="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>ค่าน้ำมัน/เดินทาง</label>
                  <input type="number" value={salForm.allow_fuel} onChange={e => setSal("allow_fuel", e.target.value)} placeholder="0.00" min="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>ค่าโทรศัพท์</label>
                  <input type="number" value={salForm.allow_phone} onChange={e => setSal("allow_phone", e.target.value)} placeholder="0.00" min="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>ค่าตำแหน่ง/อื่นๆ</label>
                  <input type="number" value={salForm.allow_pos} onChange={e => setSal("allow_pos", e.target.value)} placeholder="0.00" min="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>โบนัส</label>
                  <input type="number" value={salForm.bonus} onChange={e => setSal("bonus", e.target.value)} placeholder="0.00" min="0" />
                </div>
              </div>

              <p className="text-xs font-medium mb-2" style={{ color: "#fca5a5" }}>📤 รายการหักจากสลิป</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>ภาษีหัก ณ ที่จ่าย</label>
                  <input type="number" value={salForm.tax} onChange={e => setSal("tax", e.target.value)} placeholder={phStr(lastSalary?.tax || 0) || "0.00"} min="0" />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>→ DR 5030</div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>ประกันสังคม-ลูกจ้าง</label>
                  <input type="number" value={salForm.ss_emp} onChange={e => setSal("ss_emp", e.target.value)} placeholder={phStr(lastSalary?.ss_emp || 0) || "0.00"} min="0" />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>→ DR 1240 (asset)</div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>PVD-ลูกจ้าง</label>
                  <input type="number" value={salForm.pvd_emp} onChange={e => setSal("pvd_emp", e.target.value)} placeholder={phStr(lastSalary?.pvd_emp || 0) || "0.00"} min="0" />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>→ DR 1230 (asset)</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-medium" style={{ color: "#fca5a5" }}>💳 หักเงินกู้/หนี้สิน (เลือกได้หลายรายการ)</p>
                  <button type="button" onClick={() => setSalLoans(p => [...p, { id: String(Date.now()), loanId: "", amount: "" }])}
                    className="text-xs px-2 py-1 rounded" style={{ background: "#0f1828", color: "#60a5fa", border: "0.5px solid #2563eb44" }}>
                    + เพิ่มรายการ
                  </button>
                </div>
                {salLoans.length === 0 && <div className="text-xs px-2 py-1.5 rounded" style={{ background: "#0f1828", color: "#455672" }}>ไม่มีรายการหักหนี้สิน</div>}
                {salLoans.map(row => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 mb-1.5 items-end">
                    <div className="col-span-7">
                      <select value={row.loanId} onChange={e => setSalLoans(p => p.map(r => r.id === row.id ? { ...r, loanId: e.target.value } : r))}>
                        <option value="">— เลือกหนี้สิน —</option>
                        {salaryLoanPool.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <input type="number" value={row.amount} onChange={e => setSalLoans(p => p.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))} placeholder="0.00" min="0" />
                    </div>
                    <button type="button" onClick={() => setSalLoans(p => p.filter(r => r.id !== row.id))}
                      className="col-span-1 text-xs px-1 py-1.5 rounded" style={{ color: "#ef4444", border: "0.5px solid #ef444433" }}>✕</button>
                  </div>
                ))}
                {salaryLoanPool.length === 0 && (
                  <div className="text-xs mt-1 px-2 py-1.5 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>
                    ยังไม่มีหนี้สินในระบบ — บันทึกผ่าน Opening Balance ก่อนถ้าต้องการหักเงินกู้สวัสดิการ/สหกรณ์
                  </div>
                )}
              </div>

              <p className="text-xs font-medium mb-2" style={{ color: "#86efac" }}>🏢 นายจ้างสมทบ — ลงเป็นทรัพย์สินเพิ่ม (ไม่หักจาก net pay)</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>ประกันสังคม-นายจ้างสมทบ</label>
                  <input type="number" value={salForm.ss_er} onChange={e => setSal("ss_er", e.target.value)} placeholder={phStr(lastSalary?.ss_er || 0) || "0.00"} min="0" />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>→ DR 1240, CR 4150 (รายได้สมทบ)</div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455672" }}>PVD-นายจ้างสมทบ</label>
                  <input type="number" value={salForm.pvd_er} onChange={e => setSal("pvd_er", e.target.value)} placeholder={phStr(lastSalary?.pvd_er || 0) || "0.00"} min="0" />
                  <div className="text-xs mt-0.5" style={{ color: "#334155" }}>→ DR 1230, CR 2310 (รับรู้ตอนถอน)</div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "#455672" }}>บัญชีที่รับเงินเดือน (net pay) *</label>
                <select value={form.pmId} onChange={e => set("pmId", e.target.value)}>
                  <option value="">— เลือก —</option>
                  {salaryBankPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {salaryBankPool.length === 1 && (
                  <div className="mt-1.5 text-xs px-2 py-1.5 rounded" style={{ background: "#1a0800", color: "#fb923c", borderLeft: "2px solid #fb923c" }}>
                    ยังไม่มีบัญชีธนาคาร — บันทึกผ่าน Journal &gt; Opening Balance ก่อน
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded p-2" style={{ background: "#052e1644" }}>
                  <div style={{ color: "#86efac" }}>Gross รวม</div>
                  <div className="font-medium text-sm" style={{ color: "#22c55e" }}>{THB(salGross)}</div>
                </div>
                <div className="rounded p-2" style={{ background: "#2a000044" }}>
                  <div style={{ color: "#fca5a5" }}>หักรวม</div>
                  <div className="font-medium text-sm" style={{ color: "#ef4444" }}>{THB(salDeduct)}</div>
                </div>
                <div className="rounded p-2" style={{ background: "#0a1628" }}>
                  <div style={{ color: "#93c5fd" }}>Net pay</div>
                  <div className="font-medium text-sm" style={{ color: "#60a5fa" }}>{THB(salNet)}</div>
                </div>
              </div>
              {lastSalary && (
                <div className="mt-2 text-xs" style={{ color: "#334155" }}>
                  💡 ครั้งก่อน ({lastSalary.date}): gross {THB(lastSalary.gross)} · ภาษี {THB(lastSalary.tax)} · ปกส. {THB(lastSalary.ss_emp)} · PVD {THB(lastSalary.pvd_emp)}
                </div>
              )}
            </div>
          )}

          {/* Normal PM selector */}
          {!isObBank && !isCardSetup && !isLiabSetup && !isTransfer && !isCashAdvCC && !isCashAdvBNPL && !isCashAdvLoan && !isSalary && (
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
              {selectedNormalPMBal !== null && (
                <div className="mt-1 text-xs px-2 py-1 rounded" style={{ background: "#0a1628", color: "#60a5fa" }}>
                  คงเหลือ: <span className="font-medium">{THB(selectedNormalPMBal)}</span>
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

          {/* Insurance savings-type toggle */}
          {scen?.id === "exp_insurance" && (
            <div className="mb-3 rounded-lg p-3" style={{ background: insIsAsset ? "#052e1644" : "#0f1828", border: `0.5px solid ${insIsAsset ? "#22c55e44" : "#16243a"}` }}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={insIsAsset} onChange={e => setInsIsAsset(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                <span className="text-sm font-medium" style={{ color: insIsAsset ? "#86efac" : "#93c5fd" }}>
                  ประกันแบบสะสมทรัพย์ — บันทึกเป็นค่าใช้จ่ายล่วงหน้า (สินทรัพย์)
                </span>
              </label>
              {insIsAsset && (
                <div className="mt-2 text-xs px-2 py-1.5 rounded" style={{ background: "#0a1628", color: "#86efac", borderLeft: "2px solid #22c55e" }}>
                  จะบันทึกเป็นสินทรัพย์ (ค่าใช้จ่ายล่วงหน้า) แทนค่าใช้จ่าย
                </div>
              )}
            </div>
          )}

          {/* canBeAsset toggle */}
          {scen?.canBeAsset && (
            <div className="mb-3 rounded-lg p-3" style={{ background: expIsAsset ? "#1a2e1a" : "#0f1828", border: `0.5px solid ${expIsAsset ? "#22c55e44" : "#16243a"}` }}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={expIsAsset} onChange={e => setExpIsAsset(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                <span className="text-sm font-medium" style={{ color: expIsAsset ? "#86efac" : "#93c5fd" }}>
                  บันทึกเป็นสินทรัพย์ (ของชิ้นนี้มีมูลค่า / ใช้งานได้นาน)
                </span>
              </label>
              {expIsAsset && (
                <div className="mt-2">
                  <select value={expAssetAcct} onChange={e => setExpAssetAcct(e.target.value)}>
                    <option value="1350">เครื่องใช้ทั่วไป / เสื้อผ้า / ของใช้</option>
                    <option value="1340">อุปกรณ์ IT / อิเล็กทรอนิกส์</option>
                    <option value="1360">ของสะสม / งานศิลป์</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Preview: ob_bank */}
          {isObBank && bankName.trim() && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{bankName} ({BANK_TYPES[bankType]})</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>Opening Equity</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: ob_cc / ob_bnpl */}
          {isCardSetup && cardName.trim() && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#fca5a5" }}>Opening Equity</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{cardType === "bnpl" ? "🛒" : "💳"} {cardName}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: ob_liab */}
          {isLiabSetup && loanName.trim() && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#fca5a5" }}>Opening Equity</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{loanName}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: transfer_bank */}
          {isTransfer && transferTo && transferFrom && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{transferTo.name}</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{transferFrom.name}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: pay_cc / pay_bnpl */}
          {isDualPay && dualPayCard && dualPayBank && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{dualPayCard.name}</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{dualPayBank.name}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: pay_loan/pay_home/pay_car with individual loan */}
          {isLiabPay && selectedPayLoan && liabPayBank && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{selectedPayLoan.name}</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{liabPayBank.name}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: cash_adv_cc */}
          {isCashAdvCC && advCCCard && advCCBank && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{advCCBank.name}</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>💳 {advCCCard.name}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: cash_adv_bnpl */}
          {isCashAdvBNPL && advBNPLCard && advBNPLBank && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{advBNPLBank.name}</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>🛒 {advBNPLCard.name}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: cash_adv_loan */}
          {isCashAdvLoan && advLoanItem && advLoanBank && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>{advLoanBank.name}</span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{advLoanItem.name}</span>}
              amt={parseFloat(form.amount || "0")}
            />
          )}

          {/* Preview: normal entries */}
          {!isObBank && !isCardSetup && !isDualPay && !isTransfer && !isLiabSetup && !isCashAdvCC && !isCashAdvBNPL && !isCashAdvLoan && !(isLiabPay && selectedPayLoan) && entry && parseFloat(form.amount) > 0 && (
            <PreviewRow
              dr={<span className="text-xs" style={{ color: "#93c5fd" }}>
                {form.scenId === "exp_insurance" && insIsAsset
                  ? "ค่าใช้จ่ายล่วงหน้า (ประกันสะสมทรัพย์)"
                  : scen?.canBeAsset && expIsAsset
                    ? (COA[expAssetAcct]?.name ?? expAssetAcct)
                    : entry.drName}
              </span>}
              cr={<span className="text-xs" style={{ color: "#fca5a5" }}>{entry.crName}</span>}
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

      {/* Filter bar */}
      <div className="rounded-xl p-3 mb-3 flex flex-wrap gap-2 items-center" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>
        <span className="text-xs font-medium" style={{ color: "#455672" }}>🔎 กรอง:</span>
        <select
          value={filterAcct}
          onChange={e => setFilterAcct(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="">— ทุกบัญชี —</option>
          {acctCodesInUse.map(c => (
            <option key={c} value={c}>{c} — {acctNameOf(c)}</option>
          ))}
        </select>
        <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "0.5px solid #16243a" }}>
          {(["all","dr","cr"] as const).map(side => {
            const active = filterSide === side;
            const label = side === "all" ? "ทั้งหมด" : side === "dr" ? "Dr" : "Cr";
            const bg = active ? (side === "dr" ? "#1e3a8a" : side === "cr" ? "#7f1d1d" : "#334155") : "#0f1828";
            const color = active ? "#fff" : "#93a4be";
            return (
              <button
                key={side}
                onClick={() => setFilterSide(side)}
                disabled={!filterAcct && side !== "all"}
                className="px-3 py-1.5 text-xs font-medium"
                style={{ background: bg, color, opacity: !filterAcct && side !== "all" ? 0.4 : 1, cursor: !filterAcct && side !== "all" ? "not-allowed" : "pointer" }}
              >{label}</button>
            );
          })}
        </div>
        {(filterAcct || filterSide !== "all") && (
          <button
            onClick={() => { setFilterAcct(""); setFilterSide("all"); }}
            className="px-2 py-1 text-xs rounded"
            style={{ color: "#93a4be", border: "0.5px solid #16243a" }}
          >ล้าง</button>
        )}
        <span className="ml-auto text-xs" style={{ color: "#455672" }}>{filteredTxns.length} / {txns.length} รายการ</span>
      </div>

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
              {filteredTxns.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-sm text-center" style={{ color: "#455672" }}>{txns.length === 0 ? "ยังไม่มีรายการ" : "ไม่พบรายการตรงตามตัวกรอง"}</td></tr>
              ) : [...filteredTxns].reverse().map((t, i) => (
                <React.Fragment key={t.id}>
                  <tr style={{ background: i % 2 === 0 ? "transparent" : "#0f1828" }}>
                    <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: "#455672" }}>{t.date}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.is_system && <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold mr-1" style={{ background: "#0f2200", color: "#a3e635", fontSize: 9 }}>auto</span>}
                      <span style={{ color: "#cdd5e0" }}>{t.description}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span style={{ color: "#93c5fd" }}>{t.dr_name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span style={{ color: "#fca5a5" }}>{t.cr_name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-right whitespace-nowrap" style={{ color: "#e2e8f0" }}>{fmt(t.amount)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {!t.is_system && (
                        <span className="inline-flex gap-1">
                          <button
                            onClick={() => {
                              if (editId === t.id) { setEditId(null); return; }
                              setEditId(t.id!);
                              setEditForm({ date: t.date, desc: t.description, amount: String(t.amount) });
                            }}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: editId === t.id ? "#f59e0b" : "#60a5fa", border: `0.5px solid ${editId === t.id ? "#f59e0b44" : "#60a5fa33"}` }}
                          >✏️</button>
                          <button onClick={() => { if (confirm("ลบรายการนี้?")) deleteTransaction(t.id!); }}
                            className="text-xs px-2 py-0.5 rounded" style={{ color: "#ef4444", border: "0.5px solid #ef444433" }}>✕</button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {editId === t.id && (
                    <tr style={{ background: "#0a1628" }}>
                      <td colSpan={6} className="px-3 py-3">
                        <div className="flex gap-2 flex-wrap items-end">
                          <div>
                            <div className="text-xs mb-1" style={{ color: "#455672" }}>วันที่</div>
                            <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                              style={{ width: 130 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div className="text-xs mb-1" style={{ color: "#455672" }}>รายการ</div>
                            <input type="text" value={editForm.desc} onChange={e => setEditForm(p => ({ ...p, desc: e.target.value }))}
                              style={{ textAlign: "left", width: "100%" }} />
                          </div>
                          <div>
                            <div className="text-xs mb-1" style={{ color: "#455672" }}>จำนวน ฿</div>
                            <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                              min="0" style={{ width: 100 }} />
                          </div>
                          <button
                            disabled={editSaving}
                            onClick={async () => {
                              const amt = parseFloat(editForm.amount);
                              if (!editForm.date || isNaN(amt) || amt <= 0) return;
                              setEditSaving(true);
                              await updateTransaction(t.id!, { date: editForm.date, description: editForm.desc, amount: amt });
                              setEditSaving(false);
                              setEditId(null);
                            }}
                            className="px-3 py-1.5 rounded text-sm font-medium text-white"
                            style={{ background: "#2563eb", opacity: editSaving ? 0.6 : 1 }}
                          >{editSaving ? "..." : "บันทึก"}</button>
                          <button onClick={() => setEditId(null)}
                            className="px-3 py-1.5 rounded text-sm" style={{ background: "#0f1828", color: "#455672", border: "0.5px solid #16243a" }}>
                            ยกเลิก
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
