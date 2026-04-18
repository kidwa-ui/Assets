"use client";
import AppShell from "@/components/layout/AppShell";
import { useFinance } from "@/lib/useFinance";
import { COA, netBal, THB, fmt } from "@/lib/balance";

const MONTHS = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function dateLabel() {
  const d = new Date();
  return `ณ วันที่ ${d.getDate()} ${MONTHS[d.getMonth() + 1]} ${d.getFullYear() + 543}`;
}

const BANK_TYPES: Record<string, string> = {
  savings: "ออมทรัพย์",
  fixed:   "ฝากประจำ",
  current: "กระแสรายวัน",
  other:   "อื่นๆ",
};

export default function BalanceSheetPage() {
  const { summary, userBanks, loading } = useFinance();
  if (loading || !summary) return <AppShell><div className="text-sm" style={{ color: "#455672" }}>กำลังโหลด...</div></AppShell>;

  const { balances, totalAssets, totalLiab, totalEquity, netIncome, openingEquity, balanced, diff } = summary;
  const g = (c: string) => netBal(balances, c);

  // Current assets: cash + user banks
  const cashBal   = g("1110");
  const bankBals  = userBanks.map(b => ({ ...b, bal: balances[b.account_code] || 0 }));
  const bankTotal = bankBals.reduce((s, b) => s + b.bal, 0);
  const otherCA   = ["1130","1140","1150"];
  const otherCATotal = otherCA.reduce((s, c) => s + g(c), 0);
  const caTotal   = cashBal + bankTotal + otherCATotal;

  const INV = ["1210","1220"];
  const FIX = ["1310","1320","1330","1340","1350","1360"];
  const CL  = ["2110","2120","2130","2140"];
  const NCL = ["2210","2220","2230"];

  const invTotal = INV.reduce((s,c)=>s+g(c),0);
  const fixTotal = FIX.reduce((s,c)=>s+g(c),0);
  const clTotal  = CL.reduce((s,c)=>s+g(c),0);
  const nclTotal = NCL.reduce((s,c)=>s+g(c),0);

  return (
    <AppShell netWorth={totalEquity} netIncome={netIncome} balanced={balanced}>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-base font-medium text-white">⚖️ งบดุล / Balance Sheet</h1>
          <div className="text-xs mt-0.5" style={{ color: "#455672" }}>{dateLabel()}</div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-medium"
          style={{ color: balanced?"#22c55e":"#ef4444", background: (balanced?"#22c55e":"#ef4444")+"18", border:`0.5px solid ${balanced?"#22c55e":"#ef4444"}44` }}>
          {balanced ? "✅ BALANCED" : `❌ ต่าง ฿${fmt(Math.abs(diff))}`}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* LEFT — Assets */}
        <BSCard>
          <BSHeader bg="#14532d">สินทรัพย์ / Assets</BSHeader>
          <BSGroup label="สินทรัพย์หมุนเวียน" total={caTotal} />
          {cashBal ? <BSRow label="เงินสดติดตัว" val={cashBal} indent /> : null}
          {bankBals.filter(b => b.bal > 0).map(b => (
            <BSRow key={b.id} label={`${b.name} (${BANK_TYPES[b.type] ?? b.type})`} val={b.bal} indent />
          ))}
          {otherCA.map(c => g(c) ? <BSRow key={c} label={COA[c]?.name} val={g(c)} indent /> : null)}
          <BSSubtotal label="รวมสินทรัพย์หมุนเวียน" val={caTotal} color="#22c55e" />

          <BSGroup label="เงินลงทุน" total={invTotal} />
          {INV.map(c => g(c) ? <BSRow key={c} label={COA[c]?.name} val={g(c)} indent /> : null)}
          {invTotal ? <BSSubtotal label="รวมเงินลงทุน" val={invTotal} color="#22c55e" /> : <BSRow label="—" val={0} empty />}

          <BSGroup label="สินทรัพย์ไม่หมุนเวียน" total={fixTotal} />
          {FIX.map(c => g(c) ? <BSRow key={c} label={COA[c]?.name} val={g(c)} indent /> : null)}
          <BSSubtotal label="รวมสินทรัพย์ไม่หมุนเวียน" val={fixTotal} color="#22c55e" />

          <BSTotal label="รวมสินทรัพย์ทั้งหมด" val={totalAssets} color="#22c55e" />
        </BSCard>

        {/* RIGHT — Liabilities + Equity */}
        <div className="flex flex-col gap-4">
          <BSCard>
            <BSHeader bg="#7f1d1d">หนี้สิน / Liabilities</BSHeader>
            <BSGroup label="หนี้สินหมุนเวียน" total={clTotal} />
            {CL.map(c => g(c) ? <BSRow key={c} label={COA[c]?.name} val={g(c)} indent color="#fca5a5" /> : null)}
            <BSSubtotal label="รวมหนี้สินหมุนเวียน" val={clTotal} color="#ef4444" />

            <BSGroup label="หนี้สินไม่หมุนเวียน" total={nclTotal} />
            {NCL.map(c => g(c) ? <BSRow key={c} label={COA[c]?.name} val={g(c)} indent color="#fca5a5" /> : null)}
            <BSSubtotal label="รวมหนี้สินไม่หมุนเวียน" val={nclTotal} color="#ef4444" />

            <BSTotal label="รวมหนี้สินทั้งหมด" val={totalLiab} color="#ef4444" />
          </BSCard>

          <BSCard>
            <BSHeader bg="#3b0764">ส่วนเจ้าของ / Equity</BSHeader>
            <BSGroup label="ทุนและกำไรสะสม" total={totalEquity} />
            <BSRow label="Opening Equity" val={g("3100")} indent />
            {g("3200") ? <BSRow label="กำไรสะสม" val={g("3200")} indent /> : null}
            <BSRow label="กำไร/ขาดทุนงวดปัจจุบัน" val={netIncome} indent color={netIncome >= 0 ? "#22c55e" : "#ef4444"} />
            <BSTotal label="รวมส่วนเจ้าของทั้งหมด" val={totalEquity} color="#8b5cf6" />
          </BSCard>

          <BSCard>
            <div className="flex justify-between px-4 py-2.5 font-medium text-sm">
              <span style={{ color: "#8b5cf6" }}>รวมหนี้สิน + ส่วนเจ้าของ</span>
              <span style={{ color: "#8b5cf6" }}>{THB(totalLiab + totalEquity)}</span>
            </div>
          </BSCard>
        </div>
      </div>

      {/* Balance check */}
      <div className="mt-4 rounded-xl p-3 text-center" style={{ border:`0.5px solid ${balanced?"#22c55e44":"#ef444444"}` }}>
        <div className="font-medium text-sm" style={{ color: balanced ? "#22c55e" : "#ef4444" }}>
          {balanced ? "✅ สินทรัพย์ = หนี้สิน + ส่วนเจ้าของ" : "❌ ยังไม่ Balance"}
        </div>
        <div className="text-xs mt-1" style={{ color: "#455672" }}>
          {THB(totalAssets)} = {THB(totalLiab)} + {THB(totalEquity)} (diff = {THB(diff)})
        </div>
      </div>
    </AppShell>
  );
}

function BSCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl overflow-hidden" style={{ background: "#0b1220", border: "0.5px solid #16243a" }}>{children}</div>;
}
function BSHeader({ bg, children }: { bg: string; children: React.ReactNode }) {
  return <div className="px-4 py-2 text-xs font-medium text-white" style={{ background: bg }}>{children}</div>;
}
function BSGroup({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex justify-between px-4 py-1.5 text-xs font-medium" style={{ background: "#0f1828", borderTop: "0.5px solid #16243a", color: "#455672" }}>
      <span>{label}</span><span>{THB(total)}</span>
    </div>
  );
}
function BSRow({ label, val, indent, color, empty }: { label?: string; val: number; indent?: boolean; color?: string; empty?: boolean }) {
  if (empty) return <div className="flex justify-between px-4 py-2 text-xs" style={{ borderTop:"0.5px solid #16243a", color:"#455672" }}><span>—</span><span>—</span></div>;
  return (
    <div className="flex justify-between px-4 py-2 text-sm" style={{ borderTop: "0.5px solid #16243a", paddingLeft: indent ? 24 : 16 }}>
      <span style={{ color: color || "#cdd5e0" }}>{label}</span>
      <span style={{ color: color || (val >= 0 ? "#cdd5e0" : "#ef4444") }}>{val ? fmt(val) : "—"}</span>
    </div>
  );
}
function BSSubtotal({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex justify-between px-4 py-2 text-sm font-medium" style={{ borderTop: "0.5px solid #1e3050", background: "#0f1828", color }}>
      <span>{label}</span><span>{THB(val)}</span>
    </div>
  );
}
function BSTotal({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm font-semibold" style={{ borderTop: "1px solid #1e3050", color }}>
      <span>{label}</span><span>{THB(val)}</span>
    </div>
  );
}
