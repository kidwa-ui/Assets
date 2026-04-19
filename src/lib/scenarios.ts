export interface Scenario {
  id: string;
  group: string;
  label: string;
  dr: string;
  cr: string;
  pmRole: "receive" | "pay" | "asset_acct" | "liab_acct" | "none";
  pmLabel?: string;
  hint?: string;
  isAsset?: boolean;
}

export const SCENARIOS: Scenario[] = [
  // รายรับ
  { id: "salary",    group: "💰 รายรับ",        label: "เงินเดือน",                    dr: "PM",  cr: "4100", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเข้า" },
  { id: "freelance", group: "💰 รายรับ",        label: "Freelance / Event",            dr: "PM",  cr: "4200", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเข้า" },
  { id: "rental",    group: "💰 รายรับ",        label: "ค่าเช่าอสังหาฯ",               dr: "PM",  cr: "4300", pmRole: "receive", pmLabel: "บัญชีที่รับค่าเช่า" },
  { id: "dividend",  group: "💰 รายรับ",        label: "เงินปันผล",                    dr: "PM",  cr: "4410", pmRole: "receive", pmLabel: "บัญชีที่รับเงินปันผล" },
  { id: "inv_gain",  group: "💰 รายรับ",        label: "กำไรจากการลงทุน / ขายกองทุน",  dr: "PM",  cr: "4420", pmRole: "receive", pmLabel: "บัญชีที่รับเงิน" },
  { id: "prop_sale", group: "💰 รายรับ",        label: "กำไรจากขายอสังหาฯ",            dr: "PM",  cr: "4430", pmRole: "receive", pmLabel: "บัญชีที่รับเงิน" },
  { id: "inherit",   group: "💰 รายรับ",        label: "มรดก",                         dr: "PM",  cr: "4440", pmRole: "receive", pmLabel: "บัญชีที่รับมรดก" },
  { id: "other_inc", group: "💰 รายรับ",        label: "รายได้อื่นๆ",                  dr: "PM",  cr: "4490", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเข้า" },
  // ค่าใช้จ่าย
  { id: "expense",   group: "💸 ค่าใช้จ่าย",   label: "ค่าใช้จ่ายทั่วไป",             dr: "5000",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "interest",  group: "💸 ค่าใช้จ่าย",   label: "ดอกเบี้ยจ่าย (บัตร/สินเชื่อ)", dr: "5510",cr: "PM",   pmRole: "pay",     pmLabel: "หนี้ที่เพิ่มดอกเบี้ย", hint: "เลือกบัตรเครดิต / BNPL / สินเชื่อที่มีดอกเบี้ยเพิ่ม" },
  { id: "fee",       group: "💸 ค่าใช้จ่าย",   label: "ค่าธรรมเนียมธนาคาร",           dr: "5520",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีที่ถูกหัก" },
  // โอนเงิน
  { id: "transfer_bank", group: "🔄 โอนเงิน",  label: "โอนเงินระหว่างบัญชี",          dr: "PM",  cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีต้นทาง (หักออก)", hint: "DR = บัญชีปลายทาง (รับเงิน), CR = บัญชีต้นทาง (หักออก)" },
  // ชำระหนี้ — pay_cc / pay_bnpl ถูก handle เป็น special case ใน journal form
  { id: "pay_cc",    group: "💳 ชำระหนี้",      label: "จ่ายบิลบัตรเครดิต",            dr: "2110",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่โอนจ่าย", hint: "ไม่ใช่ Expense — แค่แลกหนี้บัตรเป็นเงินสด" },
  { id: "pay_bnpl",  group: "💳 ชำระหนี้",      label: "จ่ายคืน BNPL / Pay Later",     dr: "2120",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  { id: "pay_car",   group: "💳 ชำระหนี้",      label: "ผ่อนรถ (เงินต้น)",             dr: "2220",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่ตัดผ่อน", hint: "เฉพาะเงินต้น — ดอกเบี้ยบันทึกแยก" },
  { id: "pay_home",  group: "💳 ชำระหนี้",      label: "ผ่อนบ้าน (เงินต้น)",           dr: "2210",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่ตัดผ่อน", hint: "เฉพาะเงินต้น — ดอกเบี้ยบันทึกแยก" },
  { id: "pay_loan",  group: "💳 ชำระหนี้",      label: "ชำระเงินกู้ส่วนบุคคล",         dr: "2230",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  // ซื้อสินทรัพย์
  { id: "buy_it",    group: "🏠 ซื้อสินทรัพย์", label: "ซื้ออุปกรณ์ IT",               dr: "1340",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_home_asset", group: "🏠 ซื้อสินทรัพย์", label: "ซื้อบ้าน/คอนโด",         dr: "1320",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_land",  group: "🏠 ซื้อสินทรัพย์", label: "ซื้อที่ดิน",                   dr: "1310",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_car",   group: "🏠 ซื้อสินทรัพย์", label: "ซื้อรถ",                       dr: "1330",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_gold",  group: "🏠 ซื้อสินทรัพย์", label: "ซื้อทองคำ/ของสะสม",            dr: "1360",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_fund",  group: "🏠 ซื้อสินทรัพย์", label: "ซื้อหุ้น/กองทุน (LTF/RMF/SSF)",dr: "1210", cr: "PM",  pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_crypto",group: "🏠 ซื้อสินทรัพย์", label: "ซื้อคริปโต",                   dr: "1220",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  // Opening Balance
  { id: "ob_bank",   group: "📂 Opening Balance", label: "ยอดเงินฝากธนาคารเริ่มต้น",           dr: "1120",cr: "3100", pmRole: "none" },
  { id: "ob_cash",   group: "📂 Opening Balance", label: "ยอดเงินสดเริ่มต้น",                  dr: "1110",cr: "3100", pmRole: "none" },
  { id: "ob_asset",  group: "📂 Opening Balance", label: "สินทรัพย์ถาวรเริ่มต้น (NBV)",        dr: "PM",  cr: "3100", pmRole: "asset_acct", pmLabel: "เลือก account สินทรัพย์", hint: "เช่น ยานพาหนะ / อุปกรณ์ IT / ทองคำ" },
  { id: "ob_cc",     group: "📂 Opening Balance", label: "บัตรเครดิตเริ่มต้น",                 dr: "3100",cr: "PM",   pmRole: "none" },
  { id: "ob_bnpl",   group: "📂 Opening Balance", label: "BNPL / Pay Later เริ่มต้น",          dr: "3100",cr: "PM",   pmRole: "none" },
  { id: "ob_liab",   group: "📂 Opening Balance", label: "หนี้สินเริ่มต้น (รวม/อื่นๆ)",        dr: "3100",cr: "PM",   pmRole: "liab_acct", pmLabel: "เลือก account หนี้สิน" },
  { id: "ob_loan_personal", group: "📂 Opening Balance", label: "เงินกู้ส่วนบุคคลเริ่มต้น (ตั้งชื่อรายการ)", dr: "3100", cr: "PM", pmRole: "none", hint: "สร้าง account ใหม่สำหรับสินเชื่อแต่ละรายการ" },
  { id: "ob_loan_home",     group: "📂 Opening Balance", label: "สินเชื่อบ้านเริ่มต้น (ตั้งชื่อรายการ)",    dr: "3100", cr: "PM", pmRole: "none", hint: "สร้าง account ใหม่สำหรับสินเชื่อแต่ละรายการ" },
  { id: "ob_loan_car",      group: "📂 Opening Balance", label: "สินเชื่อรถเริ่มต้น (ตั้งชื่อรายการ)",     dr: "3100", cr: "PM", pmRole: "none", hint: "สร้าง account ใหม่สำหรับสินเชื่อแต่ละรายการ" },
];

export const PM_ASSET_ACCT = [
  { id: "a1310", name: "ที่ดิน",           acct: "1310" },
  { id: "a1320", name: "อาคาร/คอนโด",     acct: "1320" },
  { id: "a1330", name: "ยานพาหนะ",         acct: "1330" },
  { id: "a1340", name: "อุปกรณ์ IT",       acct: "1340" },
  { id: "a1360", name: "ทองคำ/ของสะสม",   acct: "1360" },
];

// บัตรเครดิตและ BNPL ถูกจัดการผ่าน cc_cards table แล้ว ไม่ได้ใช้ list นี้อีกต่อไป
export const PM_LIAB_ACCT = [
  { id: "l2210", name: "สินเชื่อบ้าน",      acct: "2210" },
  { id: "l2220", name: "สินเชื่อรถ",        acct: "2220" },
  { id: "l2230", name: "เงินกู้ส่วนบุคคล",  acct: "2230" },
];
