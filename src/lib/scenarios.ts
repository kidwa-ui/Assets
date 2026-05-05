export interface Scenario {
  id: string;
  group: string;
  label: string;
  dr: string;
  cr: string;
  pmRole: "receive" | "pay" | "asset_acct" | "liab_acct" | "liab_cr" | "none";
  pmLabel?: string;
  hint?: string;
  isAsset?: boolean;
  canBeAsset?: boolean;
}

export const SCENARIOS: Scenario[] = [
  // โอนเงิน — first so it appears at top of dropdown
  { id: "transfer_bank",  group: "🔄 โอนเงิน", label: "โอนเงินระหว่างบัญชี",                      dr: "PM",   cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีต้นทาง (หักออก)", hint: "DR = บัญชีปลายทาง (รับเงิน), CR = บัญชีต้นทาง (หักออก)" },
  { id: "receivable_pay", group: "🔄 โอนเงิน", label: "💸 สำรองจ่ายแทนคนอื่น (รอรับเงินคืน)",    dr: "1140", cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", hint: "DR ลูกหนี้ — บันทึกเมื่อจ่ายเงินแทนคนอื่นแล้วรอรับคืน" },
  { id: "receivable_recv",group: "🔄 โอนเงิน", label: "💰 รับเงินคืน / เก็บเงินลูกหนี้",          dr: "PM",   cr: "1140", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเข้า" },
  // รายรับ
  { id: "salary",    group: "💰 รายรับ",        label: "เงินเดือน (สลิป — รวมหักภาษี/ปกส./PVD)", dr: "PM", cr: "4100", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเดือน", hint: "💡 ฟอร์มเงินเดือนแบบสลิปเต็ม — กรอก gross + รายการหัก + นายจ้างสมทบ ระบบจะลงบัญชีแบบ compound ให้ครบ" },
  { id: "freelance", group: "💰 รายรับ",        label: "Freelance / Event",            dr: "PM",  cr: "4200", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเข้า" },
  { id: "rental",    group: "💰 รายรับ",        label: "ค่าเช่าอสังหาฯ",               dr: "PM",  cr: "4300", pmRole: "receive", pmLabel: "บัญชีที่รับค่าเช่า" },
  { id: "dividend",  group: "💰 รายรับ",        label: "เงินปันผล",                    dr: "PM",  cr: "4410", pmRole: "receive", pmLabel: "บัญชีที่รับเงินปันผล" },
  { id: "inv_gain",  group: "💰 รายรับ",        label: "กำไรจากการลงทุน / ขายกองทุน",  dr: "PM",  cr: "4420", pmRole: "receive", pmLabel: "บัญชีที่รับเงิน" },
  { id: "prop_sale", group: "💰 รายรับ",        label: "กำไรจากขายอสังหาฯ",            dr: "PM",  cr: "4430", pmRole: "receive", pmLabel: "บัญชีที่รับเงิน" },
  { id: "inherit",   group: "💰 รายรับ",        label: "มรดก",                         dr: "PM",  cr: "4440", pmRole: "receive", pmLabel: "บัญชีที่รับมรดก" },
  { id: "pvd_income",group: "💰 รายรับ",        label: "รายได้จาก PVD (ตอนถอน/ลาออก)", dr: "PM",  cr: "4450", pmRole: "receive", pmLabel: "บัญชีที่รับเงิน", hint: "ตอนถอน PVD: รับเงินสดจริง = รายได้ใหม่ — ส่วน asset 1230 และ deferred 2310 ให้ล้างแยก (ลงสินทรัพย์ลดด้วย scenario อื่น)" },
  { id: "other_inc", group: "💰 รายรับ",        label: "รายได้อื่นๆ",                  dr: "PM",  cr: "4490", pmRole: "receive", pmLabel: "บัญชีที่รับเงินเข้า" },
  // ค่าใช้จ่าย
  { id: "exp_food",     group: "💸 ค่าใช้จ่าย",   label: "🍜 ค่าอาหาร / ร้านอาหาร",            dr: "5001", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_grocery",  group: "💸 ค่าใช้จ่าย",   label: "🛒 วัตถุดิบ / สินค้าอุปโภค-บริโภค / ซุปเปอร์มาร์เก็ต", dr: "5002", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_fuel",     group: "💸 ค่าใช้จ่าย",   label: "⛽ เติมน้ำมัน / ค่าเชื้อเพลิง",        dr: "5003", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_transit",  group: "💸 ค่าใช้จ่าย",   label: "🚗 ค่าเดินทาง / ค่าจอดรถ / ค่าทางด่วน / ใบสั่ง / เช่ารถ / Grab / BTS-MRT", dr: "5004", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_carcare",  group: "💸 ค่าใช้จ่าย",   label: "🔧 ค่าซ่อมรถ&อะไหล่ / บำรุงรักษา / ประกันรถ / ภาษีรถ",    dr: "5019", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_fitness",  group: "💸 ค่าใช้จ่าย",   label: "🏋️ การออกกำลังกาย / สปา / วิตามิน-อาหารเสริม / ดูแลตัวเอง", dr: "5005", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_health",   group: "💸 ค่าใช้จ่าย",   label: "🏥 ค่าแพทย์ / ยา",                     dr: "5006", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_fashion",  group: "💸 ค่าใช้จ่าย",   label: "👕 เสื้อผ้า / แฟชั่น / รองเท้า",      dr: "5007", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", canBeAsset: true },
  { id: "exp_utility",  group: "💸 ค่าใช้จ่าย",   label: "💡 ค่าสาธารณูปโภค (ไฟ / น้ำ / ค่าโทรศัพท์ / อินเตอร์เน็ต)", dr: "5009", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_entertain",group: "💸 ค่าใช้จ่าย",   label: "🎬 บันเทิง / ภาพยนตร์ / เกม / Subscribe", dr: "5010", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", canBeAsset: true },
  { id: "exp_travel",   group: "💸 ค่าใช้จ่าย",   label: "✈️ ท่องเที่ยว / ที่พัก / โรงแรม",     dr: "5011", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_home",     group: "💸 ค่าใช้จ่าย",   label: "🏠 ของใช้ในบ้าน / ซ่อมแซม / เฟอร์นิเจอร์", dr: "5012", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", canBeAsset: true },
  { id: "exp_edu",      group: "💸 ค่าใช้จ่าย",   label: "📚 การศึกษา / คอร์สออนไลน์ / หนังสือ", dr: "5013", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", canBeAsset: true },
  { id: "exp_child",    group: "💸 ค่าใช้จ่าย",   label: "👶 ค่าใช้จ่ายลูก / ค่าเรียนพิเศษ",    dr: "5020", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_pet",      group: "💸 ค่าใช้จ่าย",   label: "🐶 สัตว์เลี้ยง",                       dr: "5014", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_gift",     group: "💸 ค่าใช้จ่าย",   label: "🎁 ของขวัญ / บริจาค / ทำบุญ",              dr: "5015", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_rent",     group: "💸 ค่าใช้จ่าย",   label: "🔑 ค่าเช่าบ้าน / หอพัก / ร้านค้า",    dr: "5018", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "exp_family",   group: "💸 ค่าใช้จ่าย",   label: "👨‍👩‍👧 โอนเงินให้ครอบครัว / เพื่อน / บุคคลอื่น", dr: "5016", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่โอนเงิน" },
  { id: "exp_insurance",group: "💸 ค่าใช้จ่าย",   label: "🛡️ ประกันชีวิต / ประกันสุขภาพ",              dr: "5017", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", hint: "💡 ประกันแบบสะสมทรัพย์มีมูลค่าเวนคืน → อาจบันทึกเป็นสินทรัพย์ (1150 ค่าใช้จ่ายล่วงหน้า) แทนค่าใช้จ่ายก็ได้" },
  { id: "exp_biz",      group: "💸 ค่าใช้จ่าย",   label: "💼 ค่าใช้จ่ายธุรกิจ",                 dr: "5021", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", hint: "เช่น ค่าโฆษณา ค่าซอฟต์แวร์ ค่าจ้างฟรีแลนซ์ ค่าเดินทางธุรกิจ" },
  { id: "expense",      group: "💸 ค่าใช้จ่าย",   label: "💸 ค่าใช้จ่ายอื่นๆ",                       dr: "5000", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "interest",  group: "💸 ค่าใช้จ่าย",   label: "ดอกเบี้ยจ่าย (บัตร/สินเชื่อ)", dr: "5510",cr: "PM",   pmRole: "liab_cr", pmLabel: "หนี้ที่เพิ่มดอกเบี้ย", hint: "เลือกบัตรเครดิต / BNPL / สินเชื่อที่มีดอกเบี้ยเพิ่ม" },
  { id: "fee",       group: "💸 ค่าใช้จ่าย",   label: "ค่าธรรมเนียมธนาคาร",           dr: "5520",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีที่ถูกหัก" },
  // ภาษี (จ่ายเองนอกสลิป — รวมยอดทั้งปีใน 5030 หัวข้อเดียวกับภาษีหัก ณ ที่จ่ายในสลิป)
  { id: "tax_pit",      group: "🧾 ภาษี",        label: "🧾 ภาษีเงินได้บุคคลธรรมดา (จ่ายเองตอนยื่น)", dr: "5030", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน", hint: "ลงบัญชีเดียวกับภาษีหัก ณ ที่จ่ายในสลิป (5030) → ดูยอดรวมทั้งปีในที่เดียว" },
  { id: "tax_refund",   group: "🧾 ภาษี",        label: "💰 รับคืนภาษีจากกรมสรรพากร",                dr: "PM",   cr: "5030", pmRole: "receive", pmLabel: "บัญชีที่รับเงินคืน", hint: "ลด expense 5030 (contra) → ภาษีจ่ายสุทธิทั้งปีจะแม่นยำ" },
  { id: "tax_wht_inv",  group: "🧾 ภาษี",        label: "🧾 ภาษีหัก ณ ที่จ่าย (ดอกเบี้ย/ปันผล)",     dr: "5031", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่าย/ถูกหัก" },
  { id: "tax_property", group: "🧾 ภาษี",        label: "🏠 ภาษีที่ดินและสิ่งปลูกสร้าง (รายปี)",     dr: "5032", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "tax_vehicle",  group: "🧾 ภาษี",        label: "🚗 ภาษีรถยนต์ประจำปี (ป้ายวงกลม)",         dr: "5033", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "tax_sign",     group: "🧾 ภาษี",        label: "📛 ภาษีป้าย",                              dr: "5034", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "tax_vat",      group: "🧾 ภาษี",        label: "💵 ภาษีมูลค่าเพิ่ม (VAT)",                 dr: "5035", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "tax_sbt",      group: "🧾 ภาษี",        label: "🏢 ภาษีธุรกิจเฉพาะ",                       dr: "5036", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "tax_stamp",    group: "🧾 ภาษี",        label: "📋 อากรแสตมป์",                            dr: "5037", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  { id: "tax_other",    group: "🧾 ภาษี",        label: "🧾 ภาษี/ค่าธรรมเนียมอื่นๆ (มรดก/นำเข้า/โอน)", dr: "5039", cr: "PM", pmRole: "pay", pmLabel: "ช่องทางที่จ่ายเงิน" },
  // ชำระหนี้ — pay_cc / pay_bnpl ถูก handle เป็น special case ใน journal form
  { id: "pay_cc",    group: "💳 ชำระหนี้",      label: "จ่ายบิลบัตรเครดิต",            dr: "2110",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่โอนจ่าย", hint: "ไม่ใช่ Expense — แค่แลกหนี้บัตรเป็นเงินสด" },
  { id: "pay_bnpl",  group: "💳 ชำระหนี้",      label: "จ่ายคืน BNPL / Pay Later",     dr: "2120",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  { id: "pay_car",   group: "💳 ชำระหนี้",      label: "ผ่อนรถ (เงินต้น)",             dr: "2220",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่ตัดผ่อน", hint: "เฉพาะเงินต้น — ดอกเบี้ยบันทึกแยก" },
  { id: "pay_home",  group: "💳 ชำระหนี้",      label: "ผ่อนบ้าน (เงินต้น)",           dr: "2210",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่ตัดผ่อน", hint: "เฉพาะเงินต้น — ดอกเบี้ยบันทึกแยก" },
  { id: "pay_loan",  group: "💳 ชำระหนี้",      label: "ชำระเงินกู้ส่วนบุคคล",         dr: "2230",cr: "PM",   pmRole: "pay",     pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  { id: "pay_welfare_coop", group: "💳 ชำระหนี้", label: "ชำระเงินกู้สหกรณ์",           dr: "2240", cr: "PM", pmRole: "pay", pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  { id: "pay_welfare_home", group: "💳 ชำระหนี้", label: "ชำระเงินกู้สวัสดิการบ้าน",    dr: "2250", cr: "PM", pmRole: "pay", pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  { id: "pay_welfare_car",  group: "💳 ชำระหนี้", label: "ชำระเงินกู้สวัสดิการรถ",      dr: "2260", cr: "PM", pmRole: "pay", pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  { id: "pay_welfare_other",group: "💳 ชำระหนี้", label: "ชำระเงินกู้สวัสดิการอื่นๆ",   dr: "2270", cr: "PM", pmRole: "pay", pmLabel: "บัญชีธนาคารที่โอนจ่าย" },
  // ซื้อสินทรัพย์
  { id: "buy_it",    group: "🏠 ซื้อสินทรัพย์", label: "ซื้ออุปกรณ์ IT",               dr: "1340",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_home_asset", group: "🏠 ซื้อสินทรัพย์", label: "ซื้อบ้าน/คอนโด",         dr: "1320",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_land",  group: "🏠 ซื้อสินทรัพย์", label: "ซื้อที่ดิน",                   dr: "1310",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_car",   group: "🏠 ซื้อสินทรัพย์", label: "ซื้อรถ",                       dr: "1330",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_gold",  group: "🏠 ซื้อสินทรัพย์", label: "ซื้อทองคำ/ของสะสม",            dr: "1360",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_fund",  group: "🏠 ซื้อสินทรัพย์", label: "ซื้อหุ้น/กองทุน (LTF/RMF/SSF)",dr: "1210", cr: "PM",  pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  { id: "buy_crypto",group: "🏠 ซื้อสินทรัพย์", label: "ซื้อคริปโต",                   dr: "1220",cr: "PM",   pmRole: "pay",     pmLabel: "ช่องทางที่จ่าย", isAsset: true },
  // เบิกเงินสด / รับวงเงินสินเชื่อ
  { id: "cash_adv_cc",   group: "🏦 เบิกเงิน / รับสินเชื่อ", label: "💸 เบิกเงินสดจากบัตรเครดิต",          dr: "PM", cr: "PM", pmRole: "pay", hint: "DR บัญชีรับเงิน, CR บัตรเครดิตที่เพิ่มหนี้" },
  { id: "cash_adv_bnpl", group: "🏦 เบิกเงิน / รับสินเชื่อ", label: "🛒 เบิกเงินสดจากสินเชื่อ BNPL",        dr: "PM", cr: "PM", pmRole: "pay", hint: "DR บัญชีรับเงิน, CR บัญชี BNPL ที่เพิ่มหนี้" },
  { id: "cash_adv_loan", group: "🏦 เบิกเงิน / รับสินเชื่อ", label: "🏦 รับเงินกู้ / เบิกสินเชื่อ (วงเงินใหม่)", dr: "PM", cr: "PM", pmRole: "pay", hint: "DR บัญชีรับเงิน, CR สินเชื่อที่เพิ่มยอดหนี้" },
  // Opening Balance
  { id: "ob_bank",   group: "📂 Opening Balance", label: "ยอดเงินฝากธนาคารเริ่มต้น",           dr: "1120",cr: "3100", pmRole: "none" },
  { id: "ob_cash",   group: "📂 Opening Balance", label: "ยอดเงินสดเริ่มต้น",                  dr: "1110",cr: "3100", pmRole: "none" },
  { id: "ob_asset",  group: "📂 Opening Balance", label: "สินทรัพย์ถาวรเริ่มต้น (NBV)",        dr: "PM",  cr: "3100", pmRole: "asset_acct", pmLabel: "เลือก account สินทรัพย์", hint: "เช่น ยานพาหนะ / อุปกรณ์ IT / ทองคำ" },
  { id: "ob_cc",     group: "📂 Opening Balance", label: "บัตรเครดิตเริ่มต้น",                 dr: "3100",cr: "PM",   pmRole: "none" },
  { id: "ob_bnpl",   group: "📂 Opening Balance", label: "BNPL / Pay Later เริ่มต้น",          dr: "3100",cr: "PM",   pmRole: "none" },
  { id: "ob_liab",   group: "📂 Opening Balance", label: "หนี้สินเริ่มต้น (สินเชื่อ)",          dr: "3100",cr: "PM",   pmRole: "none", hint: "ตั้งชื่อสินเชื่อแต่ละรายการ เช่น บ้านหลัง 1 — ออมสิน, Toyota Yaris — KBank" },
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
  { id: "l2210", name: "สินเชื่อบ้าน",                acct: "2210" },
  { id: "l2220", name: "สินเชื่อรถ",                  acct: "2220" },
  { id: "l2230", name: "เงินกู้ส่วนบุคคล",            acct: "2230" },
  { id: "l2240", name: "เงินกู้สวัสดิการ-สหกรณ์",      acct: "2240" },
  { id: "l2250", name: "เงินกู้สวัสดิการบ้าน",        acct: "2250" },
  { id: "l2260", name: "เงินกู้สวัสดิการรถ",          acct: "2260" },
  { id: "l2270", name: "เงินกู้สวัสดิการอื่นๆ",       acct: "2270" },
];
