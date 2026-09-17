import { HelpCircle, LogOut, User } from 'lucide-react'
import { api } from '../api/client'

type HeaderProps = { user: { name: string; email: string } }

export function Header({ user }: HeaderProps) {
  return <header className="h-16 border-b border-slate-800 bg-[#0b0b0d] text-white"><div className="flex h-full items-center justify-between px-5">
    <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center bg-white text-slate-950"><span className="text-xs font-black">CM</span></div><div><p className="text-sm font-semibold">Credential Control Panel</p><p className="text-[11px] text-slate-400">n8n workflow credential management</p></div></div>
    <div className="flex items-center gap-2"><button className="rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" title="Help"><HelpCircle className="h-4 w-4" /></button><div className="mx-2 hidden h-7 w-px bg-slate-700 sm:block" /><div className="flex items-center gap-2 rounded-md px-2 py-1.5"><User className="h-4 w-4 text-slate-400" /><div className="hidden text-right sm:block"><p className="text-xs font-medium">{user.name}</p><p className="text-[10px] text-slate-400">{user.email}</p></div></div><button onClick={() => api.logout()} className="rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" title="Logout"><LogOut className="h-4 w-4" /></button></div>
  </div></header>
}
