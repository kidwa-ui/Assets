# Personal Ledger — Assets

บันทึกการเงินส่วนบุคคลแบบ double-entry bookkeeping

## Stack
- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel

## Features
- Journal บันทึกรายรับ-รายจ่าย พร้อม Dr/Cr อัตโนมัติ
- งบดุล 2 คอลัมน์ (สินทรัพย์ / หนี้สิน + ส่วนเจ้าของ)
- P&L งบกำไรขาดทุน
- Recurring — ผ่อนบ้าน/รถ พร้อม Upcoming queue
- บัตรเครดิต — Statement Sync
- PWA รองรับมือถือ

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
