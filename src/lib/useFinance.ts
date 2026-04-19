"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { calcSummary, type Transaction, type Summary } from "@/lib/balance";

export interface CCCard {
  id: string;
  name: string;
  account_code: string;
  bank_id: string;
  card_type: string; // "credit" | "bnpl"
}

export interface CCStatement {
  id: string;
  card_id: string;
  statement_date: string;
  statement_balance: number;
  interest_amount: number;
  paid_amount: number;
  paid_date: string | null;
}

export interface Schedule {
  id: string;
  name: string;
  liability_id: string;
  bank_id: string;
  interest_rate: number;
  default_total: number;
  confirmed_interest: number | null;
  day_of_month: number;
  next_date: string;
  is_active: boolean;
}

export interface QueueItem {
  id: string;
  schedule_id: string;
  due_date: string;
  default_total: number;
  interest: number;
  status: "pending" | "confirmed" | "skipped";
  paid_date: string | null;
  paid_total: number | null;
  paid_principal: number | null;
  paid_interest: number | null;
  // joined
  schedule?: Schedule;
}

export interface UserBank {
  id: string;
  name: string;
  type: string;
  account_code: string;
}

export interface UserLiab {
  id: string;
  name: string;
  type: string; // "personal" | "home" | "car"
  account_code: string;
}

// Account code ranges for individual loans
const LIAB_RANGES: Record<string, [number, number]> = {
  home:     [2211, 2219],
  car:      [2221, 2229],
  personal: [2231, 2259],
};

export function useFinance() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [userBanks, setUserBanks] = useState<UserBank[]>([]);
  const [ccCards, setCCCards] = useState<CCCard[]>([]);
  const [ccStatements, setCCStatements] = useState<CCStatement[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [userLiabs, setUserLiabs] = useState<UserLiab[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserCreatedAt(user.created_at ? user.created_at.slice(0, 10) : null);
        loadAll(user.id);
      }
    });
  }, []);

  useEffect(() => {
    const bankDyn = Object.fromEntries(
      userBanks.map(b => [b.account_code, { name: b.name, type: "asset" as const, normal: "debit" as const, subtype: "current" as const }])
    );
    const cardDyn = Object.fromEntries(
      ccCards.map(c => [c.account_code, { name: c.name, type: "liability" as const, normal: "credit" as const, subtype: "current" as const }])
    );
    const liabDyn = Object.fromEntries(
      userLiabs.map(l => [l.account_code, { name: l.name, type: "liability" as const, normal: "credit" as const, subtype: "noncurrent" as const }])
    );
    setSummary(calcSummary(txns, { ...bankDyn, ...cardDyn, ...liabDyn }));
  }, [txns, userBanks, ccCards, userLiabs]);

  const loadAll = useCallback(async (uid: string) => {
    setLoading(true);
    const [t, ub, c, s, sc, q, ul] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", uid).order("date", { ascending: true }),
      supabase.from("user_banks").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      supabase.from("cc_cards").select("*").eq("user_id", uid),
      supabase.from("cc_statements").select("*").eq("user_id", uid).order("statement_date", { ascending: false }),
      supabase.from("schedules").select("*").eq("user_id", uid).eq("is_active", true),
      supabase.from("queue_items").select("*, schedule:schedules(*)").eq("user_id", uid).order("due_date"),
      supabase.from("user_liabs").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    ]);
    if (t.data) setTxns(t.data.map(r => ({ ...r, dr_account: r.dr_account, cr_account: r.cr_account })));
    if (ub.data) setUserBanks(ub.data);
    if (c.data) setCCCards(c.data);
    if (s.data) setCCStatements(s.data);
    if (sc.data) setSchedules(sc.data);
    if (q.data) setQueueItems(q.data);
    if (ul.data) setUserLiabs(ul.data);
    setLoading(false);
  }, []);

  const addTransaction = async (txn: Omit<Transaction, "id">): Promise<{ error: { message: string } | null }> => {
    if (!userId) return { error: null };
    const { data, error } = await supabase.from("transactions").insert({ ...txn, user_id: userId }).select().single();
    if (!error && data) setTxns(p => [...p, data]);
    return { error };
  };

  const updateTransaction = async (id: string, fields: Partial<Pick<Transaction, "date" | "description" | "amount">>): Promise<{ error: { message: string } | null }> => {
    const { error } = await supabase.from("transactions").update(fields).eq("id", id);
    if (!error) setTxns(p => p.map(t => t.id === id ? { ...t, ...fields } : t));
    return { error };
  };

  const deleteTransaction = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    setTxns(p => p.filter(t => t.id !== id));
  };

  const addUserBank = async (name: string, type: string): Promise<{ bank?: UserBank; error?: { message: string } }> => {
    if (!userId) return {};
    const existingCodes = userBanks.map(b => parseInt(b.account_code)).filter(n => !isNaN(n));
    const next = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1121;
    const account_code = String(Math.min(next, 1199));
    const { data, error } = await supabase.from("user_banks").insert({ user_id: userId, name, type, account_code }).select().single();
    if (!error && data) { setUserBanks(p => [...p, data]); return { bank: data }; }
    return { error: error ? { message: error.message } : { message: "Unknown error" } };
  };

  const deleteUserBank = async (id: string) => {
    await supabase.from("user_banks").delete().eq("id", id);
    setUserBanks(p => p.filter(b => b.id !== id));
  };

  const addCCCard = async (card: { name: string; card_type: string; bank_id: string }): Promise<{ card?: CCCard; error?: { message: string } }> => {
    if (!userId) return {};
    const rangeStart = card.card_type === "bnpl" ? 2151 : 2111;
    const rangeEnd   = card.card_type === "bnpl" ? 2189 : 2149;
    const existing = ccCards
      .filter(c => c.card_type === card.card_type)
      .map(c => parseInt(c.account_code))
      .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : rangeStart;
    const account_code = String(Math.min(next, rangeEnd));
    const { data, error } = await supabase
      .from("cc_cards")
      .insert({ ...card, account_code, user_id: userId })
      .select().single();
    if (!error && data) { setCCCards(p => [...p, data]); return { card: data }; }
    return { error: error ? { message: error.message } : { message: "Unknown error" } };
  };

  const deleteCCCard = async (id: string) => {
    await supabase.from("cc_cards").delete().eq("id", id);
    setCCCards(p => p.filter(c => c.id !== id));
  };

  const addUserLiab = async (name: string, type: string): Promise<{ liab?: UserLiab; error?: { message: string } }> => {
    if (!userId) return {};
    const [rangeStart, rangeEnd] = LIAB_RANGES[type] ?? [2231, 2259];
    const existing = userLiabs
      .filter(l => l.type === type)
      .map(l => parseInt(l.account_code))
      .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : rangeStart;
    const account_code = String(Math.min(next, rangeEnd));
    const { data, error } = await supabase
      .from("user_liabs")
      .insert({ user_id: userId, name, type, account_code })
      .select().single();
    if (!error && data) { setUserLiabs(p => [...p, data]); return { liab: data }; }
    return { error: error ? { message: error.message } : { message: "Unknown error" } };
  };

  const deleteUserLiab = async (id: string) => {
    await supabase.from("user_liabs").delete().eq("id", id);
    setUserLiabs(p => p.filter(l => l.id !== id));
  };

  const syncCCStatement = async (params: {
    cardId: string; cardAcct: string; stmtDate: string; stmtBalance: number;
    paidDate: string; paidAmount: number; bankAcct: string; bankName: string; cardName: string;
  }) => {
    if (!userId) return;
    const curBal = (summary?.balances?.[params.cardAcct] || 0) * -1;
    const diff = params.stmtBalance - curBal;

    if (diff > 0.5) {
      await addTransaction({ date: params.stmtDate, description: `ดอกเบี้ย ${params.cardName} (${params.stmtDate})`, dr_account: "5510", cr_account: params.cardAcct, dr_name: "ดอกเบี้ยจ่าย", cr_name: params.cardName, amount: diff, is_system: true });
    }
    if (params.paidAmount > 0.5) {
      await addTransaction({ date: params.paidDate, description: `ชำระ ${params.cardName} (stmt ${params.stmtDate})`, dr_account: params.cardAcct, cr_account: params.bankAcct, dr_name: params.cardName, cr_name: params.bankName, amount: params.paidAmount, is_system: true });
    }

    const { data } = await supabase.from("cc_statements").insert({ user_id: userId, card_id: params.cardId, statement_date: params.stmtDate, statement_balance: params.stmtBalance, interest_amount: Math.max(0, diff), paid_amount: params.paidAmount, paid_date: params.paidDate }).select().single();
    if (data) setCCStatements(p => [data, ...p]);
  };

  const addSchedule = async (sched: Omit<Schedule, "id">): Promise<{ error: { message: string } | null }> => {
    if (!userId) return { error: null };
    const { data, error } = await supabase.from("schedules").insert({ ...sched, user_id: userId }).select().single();
    if (!error && data) {
      setSchedules(p => [...p, data]);
      await generateQueueItem(data, userId);
    }
    return { error };
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("schedules").update({ is_active: false }).eq("id", id);
    await supabase.from("queue_items").delete().eq("schedule_id", id).eq("status", "pending");
    setSchedules(p => p.filter(s => s.id !== id));
    setQueueItems(p => p.filter(q => !(q.schedule_id === id && q.status === "pending")));
  };

  const confirmSchedInterest = async (schedId: string, interest: number) => {
    await supabase.from("schedules").update({ confirmed_interest: interest }).eq("id", schedId);
    await supabase.from("queue_items").update({ interest }).eq("schedule_id", schedId).eq("status", "pending");
    setSchedules(p => p.map(s => s.id === schedId ? { ...s, confirmed_interest: interest } : s));
    setQueueItems(p => p.map(q => q.schedule_id === schedId && q.status === "pending" ? { ...q, interest } : q));
  };

  const generateQueueItem = async (sched: Schedule, uid: string) => {
    const existing = queueItems.some(q => q.schedule_id === sched.id && q.status === "pending");
    if (existing) return;
    const { data } = await supabase.from("queue_items").insert({
      user_id: uid, schedule_id: sched.id, due_date: sched.next_date,
      default_total: sched.default_total, interest: sched.confirmed_interest ?? 0, status: "pending",
    }).select("*, schedule:schedules(*)").single();
    if (data) setQueueItems(p => [...p, data]);
  };

  const confirmQueueItem = async (queueId: string, params: { date: string; total: number; interest: number; principal: number; liabAcct: string; liabName: string; schedId: string; dayOfMonth: number }) => {
    if (params.principal > 0)
      await addTransaction({ date: params.date, description: `ผ่อน ${params.date} — เงินต้น`, dr_account: params.liabAcct, cr_account: "1120", dr_name: params.liabName, cr_name: "เงินฝาก", amount: params.principal, is_system: true });
    if (params.interest > 0)
      await addTransaction({ date: params.date, description: `ผ่อน ${params.date} — ดอกเบี้ย`, dr_account: "5510", cr_account: "1120", dr_name: "ดอกเบี้ยจ่าย", cr_name: "เงินฝาก", amount: params.interest, is_system: true });

    await supabase.from("queue_items").update({ status: "confirmed", paid_date: params.date, paid_total: params.total, paid_principal: params.principal, paid_interest: params.interest }).eq("id", queueId);

    const nd = new Date(params.date);
    nd.setMonth(nd.getMonth() + 1);
    nd.setDate(params.dayOfMonth);
    const nextDate = nd.toISOString().slice(0, 10);
    await supabase.from("schedules").update({ confirmed_interest: null, next_date: nextDate }).eq("id", params.schedId);

    const updatedSched = schedules.find(s => s.id === params.schedId);
    if (updatedSched) {
      const ns = { ...updatedSched, confirmed_interest: null, next_date: nextDate };
      setSchedules(p => p.map(s => s.id === params.schedId ? ns : s));
      setQueueItems(p => p.map(q => q.id === queueId ? { ...q, status: "confirmed", paid_date: params.date, paid_total: params.total, paid_principal: params.principal, paid_interest: params.interest } : q));
      if (userId) await generateQueueItem(ns, userId);
    }
  };

  const skipQueueItem = async (queueId: string, dueDate: string, schedId: string, dayOfMonth: number) => {
    await supabase.from("queue_items").update({ status: "skipped", paid_total: 0 }).eq("id", queueId);
    const nd = new Date(dueDate);
    nd.setMonth(nd.getMonth() + 1);
    nd.setDate(dayOfMonth);
    const nextDate = nd.toISOString().slice(0, 10);
    await supabase.from("schedules").update({ next_date: nextDate }).eq("id", schedId);
    const updatedSched = schedules.find(s => s.id === schedId);
    if (updatedSched && userId) {
      const ns = { ...updatedSched, next_date: nextDate };
      setSchedules(p => p.map(s => s.id === schedId ? ns : s));
      setQueueItems(p => p.map(q => q.id === queueId ? { ...q, status: "skipped" } : q));
      await generateQueueItem(ns, userId);
    }
  };

  return {
    loading, userId, userCreatedAt, summary, txns,
    userBanks, addUserBank, deleteUserBank,
    ccCards, ccStatements, schedules, queueItems,
    userLiabs, addUserLiab, deleteUserLiab,
    addTransaction, updateTransaction, deleteTransaction,
    addCCCard, deleteCCCard, syncCCStatement,
    addSchedule, deleteSchedule, confirmSchedInterest,
    confirmQueueItem, skipQueueItem,
    reload: () => userId && loadAll(userId),
  };
}
