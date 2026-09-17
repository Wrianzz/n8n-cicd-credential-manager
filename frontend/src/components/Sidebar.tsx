import { Activity, Boxes, FileClock, GitBranch, LayoutDashboard, Server, ShieldCheck } from 'lucide-react'

type Props = { path: string; onNavigate: (path: string) => void }
const items = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Workflows', path: '/workflows', icon: GitBranch },
  { label: 'Mappings', path: '/mappings', icon: Boxes },
  { label: 'Drafts', path: '/drafts', icon: FileClock },
  { label: 'Audit Logs', path: '/audit', icon: Activity }
]

export function Sidebar({ path, onNavigate }: Props) {
  return <aside className="w-64 shrink-0 border-r border-slate-200 bg-white"><div className="sticky top-0 flex h-[calc(100vh-4rem)] flex-col px-3 py-5">
    <div className="px-3 pb-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-bold text-slate-950">Credential Manager</p><p className="text-xs text-slate-500">n8n security console</p></div></div></div>
    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Overview</p>
    <nav className="space-y-1">{items.map(({ label, path: itemPath, icon: Icon }) => { const active = path === itemPath || (itemPath === '/mappings' && path.startsWith('/mappings/')); return <button key={itemPath} onClick={() => onNavigate(itemPath)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}><Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />{label}</button> })}</nav>
    <div className="my-5 border-t border-slate-100" /><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">System</p>
    <button onClick={() => onNavigate('/repository')} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${path === '/repository' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}><Server className="h-4 w-4" />Repository</button>
  </div></aside>
}
