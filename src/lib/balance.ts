export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountSubtype = "current" | "invest" | "fixed" | "noncurrent";

export interface Account {
  name: string;
  type: AccountType;
  normal: "debit" | "credit";
  subtype?: AccountSubtype;
}

export const COA: Record<string, Account> = {
  "1110": { name: "เงินสดติดตัว",        type: "asset",    normal: "debit",  subtype: "current" },
  "1120": { name: "เงินฝากธนาคาร",       type: "asset",    normal: "debit",  subtype: "current" },
  "1130": { name: "เงินฝากประจำ",        type: "asset",    normal: "debit",  subtype: "current" },
  "1140": { name: "ลูกหนี้",             type: "asset",    normal: "debit",  subtype: "current" },
  "1150": { name: "ค่าใช้จ่ายล่วงหน้า",  type: "asset",    normal: "debit",  subtype: "current" },
  "1210": { name: "หุ้น/กองทุน",          type: "asset",    normal: "debit",  subtype: "invest"  },
  "1220": { name: "คริปโต",              type: "asset",    normal: "debit",  subtype: "invest"  },
  "1310": { name: "ที่ดิน",               type: "asset",    normal: "debit",  subtype: "fixed"   },
  "1320": { name: "อาคาร/คอนโด",         type: "asset",    normal: "debit",  subtype: "fixed"   },
  "1330": { name: "ยานพาหนะ",            type: "asset",    normal: "debit",  subtype: "fixed"   },
  "1340": { name: "อุปกรณ์ IT",          type: "asset",    normal: "debit",  subtype: "fixed"   },
  "1350": { name: "เครื่องใช้ในบ้าน",     type: "asset",    normal: "debit",  subtype: "fixed"   },
  "1360": { name: "ทองคำ/ของสะสม",       type: "asset",    normal: "debit",  subtype: "fixed"   },
  "2110": { name: "เจ้าหนี้บัตรเครดิต",   type: "liability",normal: "credit", subtype: "current" },
  "2120": { name: "BNPL/ผ่อนชำระ",       type: "liability",normal: "credit", subtype: "current" },
  "2130": { name: "เงินกู้ระยะสั้น",       type: "liability",normal: "credit", subtype: "current" },
  "2140": { name: "ค่าใช้จ่ายค้างจ่าย",   type: "liability",normal: "credit", subtype: "current" },
  "2210": { name: "สินเชื่อบ้าน",         type: "liability",normal: "credit", subtype: "noncurrent" },
  "2220": { name: "สินเชื่อรถ",           type: "liability",normal: "credit", subtype: "noncurrent" },
  "2230": { name: "เงินกู้ส่วนบุคคล",     type: "liability",normal: "credit", subtype: "noncurrent" },
  "3100": { name: "Opening Equity",      type: "equity",   normal: "credit" },
  "3200": { name: "กำไรสะสม",            type: "equity",   normal: "credit" },
  "4100": { name: "เงินเดือน",           type: "income",   normal: "credit" },
  "4200": { name: "Freelance/Event",     type: "income",   normal: "credit" },
  "4300": { name: "ค่าเช่า",             type: "income",   normal: "credit" },
  "4410": { name: "เงินปันผล",           type: "income",   normal: "credit" },
  "4420": { name: "กำไรลงทุน",           type: "income",   normal: "credit" },
  "4430": { name: "กำไรขายอสังหาฯ",      type: "income",   normal: "credit" },
  "4440": { name: "มรดก",               type: "income",   normal: "credit" },
  "4490": { name: "รายได้อื่นๆ",         type: "income",   normal: "credit" },
  "5000": { name: "ค่าใช้จ่ายทั่วไป",    type: "expense",  normal: "debit"  },
  "5510": { name: "ดอกเบี้ยจ่าย",        type: "expense",  normal: "debit"  },
  "5520": { name: "ค่าธรรมเนียม",        type: "expense",  normal: "debit"  },
  "5530": { name: "ค่าเสื่อมราคา",       type: "expense",  normal: "debit"  },
};

export interface Transaction {
  id?: string;
  date: string;
  description: string;
  dr_account: string;
  cr_account: string;
  dr_name: string;
  cr_name: string;
  amount: number;
  is_system?: boolean;
}

export type Balances = Record<string, number>;

export function buildBalances(txns: Transaction[]): Balances {
  const b: Balances = {};
  for (const t of txns) {
    b[t.dr_account] = (b[t.dr_account] || 0) + t.amount;
    b[t.cr_account] = (b[t.cr_account] || 0) - t.amount;
  }
  return b;
}

export function netBal(b: Balances, code: string): number {
  const a = COA[code];
  if (!a) return 0;
  const raw = b[code] || 0;
  return a.normal === "debit" ? raw : -raw;
}

export interface Summary {
  balances: Balances;
  totalAssets: number;
  totalLiab: number;
  totalInc: number;
  totalExp: number;
  netIncome: number;
  openingEquity: number;
  totalEquity: number;
  diff: number;
  balanced: boolean;
}

export function calcSummary(txns: Transaction[]): Summary {
  const b = buildBalances(txns);
  const byType = (t: AccountType) =>
    Object.entries(COA).filter(([, v]) => v.type === t).map(([k]) => k);
  const sum = (codes: string[]) => codes.reduce((s, c) => s + netBal(b, c), 0);

  const totalAssets = sum(byType("asset"));
  const totalLiab   = sum(byType("liability"));
  const totalInc    = sum(byType("income"));
  const totalExp    = sum(byType("expense"));
  const netIncome   = totalInc - totalExp;
  const openingEquity = netBal(b, "3100") + netBal(b, "3200");
  const totalEquity = openingEquity + netIncome;
  const diff = totalAssets - totalLiab - totalEquity;

  return { balances: b, totalAssets, totalLiab, totalInc, totalExp, netIncome, openingEquity, totalEquity, diff, balanced: Math.abs(diff) < 0.01 };
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export const fmtK = (n: number) => {
  const a = Math.abs(n || 0);
  return a >= 1e6 ? (n / 1e6).toFixed(2) + "M" : a >= 1e3 ? (n / 1e3).toFixed(1) + "K" : fmt(n);
};

export const THB = (n: number) => "฿" + fmt(n);
