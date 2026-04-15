"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard",     icon: "📊", label: "Dashboard" },
  { href: "/upcoming",      icon: "📅", label: "Upcoming" },
  { href: "/journal",       icon: "📒", label: "Journal" },
  { href: "/recurring",     icon: "🔄", label: "Recurring" },
  { href: "/credit-cards",  icon: "💳", label: "บัตรเครดิต" },
  { href: "/balance-sheet", icon: "⚖️", label: "งบดุล" },
  { href: "/pl",            icon: "📈", label: "P&L" },
];

interface Props {
  children: React.ReactNode;
  netWorth?: number;
  netIncome?: number;
  balanced?: boolean;
  pendingCount?: number;
}

export default function AppShell({ children, netWorth = 0, netIncome = 0, balanced = true, pendingCount = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
  }

  const fmtK = (n: number) => {
    const a = Math.abs(n);
    const s = n < 0 ? "-" : "+";
    return a >= 1e6 ? s + (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? s + (a / 1e3).toFixed(0) + "K" : s + a.toFixed(0);
  };

  return (
    <div className="min-h-screen" style={{ background: "#07090f" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-50 flex items-center gap-2 px-4 h-12"
        style={{ background: "#0b1220", borderBottom: "0.5px solid #16243a" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs shrink-0"
          style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>฿</div>
        <span className="font-medium text-sm text-white">Personal Ledger</span>

        {pendingCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: "#ef4444" }}>
            {pendingCount}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs flex-wrap justify-end">
          <Chip color={balanced ? "#22c55e" : "#ef4444"}>
            {balanced ? "✓ Balance" : "⚠ ไม่ Balance"}
          </Chip>
          <Chip color="#60a5fa">
            Net Worth <b className="ml-1">{fmtK(netWorth)}฿</b>
          </Chip>
          <Chip color={netIncome >= 0 ? "#22c55e" : "#ef4444"}>
            P&L <b className="ml-1">{fmtK(netIncome)}฿</b>
          </Chip>
          <button onClick={handleLogout}
            className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-70"
            style={{ color: "#455672" }}>ออก</button>
        </div>
      </div>

      {/* Desktop side nav + content */}
      <div className="flex">
        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex flex-col w-48 shrink-0 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto"
          style={{ background: "#0b1220", borderRight: "0.5px solid #16243a" }}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href}
              className="flex items-center gap-3 px-4 py-3 text-sm transition-colors"
              style={{
                color: pathname === n.href ? "#60a5fa" : "#455672",
                background: pathname === n.href ? "#0f1828" : "transparent",
                borderLeft: pathname === n.href ? "2px solid #3b82f6" : "2px solid transparent",
              }}>
              <span className="text-base">{n.icon}</span>
              <span>{n.label}</span>
            </a>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto p-4">{children}</div>
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex overflow-x-auto z-50"
        style={{ background: "#0b1220", borderTop: "0.5px solid #16243a" }}>
        {NAV.map((n) => (
          <a key={n.href} href={n.href}
            className="flex flex-col items-center gap-0.5 px-3 py-2 text-center shrink-0 min-w-[60px]"
            style={{ color: pathname === n.href ? "#60a5fa" : "#455672" }}>
            <span className="text-lg">{n.icon}</span>
            <span className="text-[9px] leading-tight">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium"
      style={{ color, background: color + "18", border: `0.5px solid ${color}44` }}>
      {children}
    </span>
  );
}
