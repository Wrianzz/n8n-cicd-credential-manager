import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, RefreshCcw, Search, Users, Workflow } from 'lucide-react'
import type { BranchInfo } from './types'
import { api } from './api/client'
import { Header } from './components/Header'
import { MappingEditor } from './components/MappingEditor'
import { Sidebar } from './components/Sidebar'

type CurrentUser = { id: string; email: string; name: string }
type PageProps = { navigate: (path: string) => void }
type WorkflowTeam = { name: string; workflowCount: number }
type WorkflowFolder = { name: string; workflowCount: number; workflows: BranchInfo[] }

function PageHeader({ title, description, action }: { title: string; description: string; action?: any }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>{action}</div>
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Users }) {
  return <div className="cm-card p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p></div><div className="rounded-lg bg-slate-100 p-2.5 text-slate-600"><Icon className="h-5 w-5" /></div></div></div>
}

function Info({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 font-medium text-slate-800 ${mono ? 'font-mono text-sm' : ''}`}>{value}</p></div>
}

function Loading() { return <div className="cm-card p-10 text-center text-sm text-slate-500">Loading...</div> }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-slate-500">{text}</div> }
function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{message}{onRetry && <button className="ml-3 font-medium underline" onClick={onRetry}>Retry</button>}</div> }

function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => { setLoading(true); setError(''); api.dashboard().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)) }
  useEffect(load, [])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={load} />
  const s = data.summary
  return <>
    <PageHeader title="Dashboard" description="Review the current state of workflow credential mappings and repository activity." action={<button className="cm-btn-secondary" onClick={load}><RefreshCcw className="h-4 w-4" /> Refresh</button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Teams" value={s.teams} icon={Users} />
      <StatCard label="Workflows" value={s.workflows} icon={Workflow} />
      <StatCard label="Configured mappings" value={s.mappings} icon={GitBranch} />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="cm-card p-5"><div className="mb-5"><h2 className="font-semibold text-slate-950">Repository status</h2><p className="text-sm text-slate-500">Current repository inventory.</p></div><div className="grid gap-3 sm:grid-cols-2"><Info label="Status" value="Connected" /><Info label="Remote" value={data.repository.remote} mono /><Info label="Teams" value={data.repository.teamCount} /><Info label="Workflows" value={data.repository.workflowCount} /></div><div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Last checked {new Date(data.repository.syncedAt).toLocaleString()}</div></section>
      <section className="cm-card p-5"><div className="mb-4"><h2 className="font-semibold text-slate-950">Recent activity</h2><p className="text-sm text-slate-500">Latest audit events.</p></div><div className="divide-y divide-slate-100">{data.recentActivity.length === 0 ? <Empty text="No activity recorded yet." /> : data.recentActivity.map((row: any) => <div key={row.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium text-slate-800">{row.action}</p><p className="text-xs text-slate-500">{row.actorEmail}{row.workflowId ? ` · ${row.workflowId}` : ''}</p></div><span className="shrink-0 text-xs text-slate-400">{new Date(row.createdAt).toLocaleString()}</span></div>)}</div></section>
    </div>
  </>
}

function WorkflowsPage({ navigate }: PageProps) {
  const [q, setQ] = useState('')
  const [teams, setTeams] = useState<WorkflowTeam[]>([])
  const [folders, setFolders] = useState<WorkflowFolder[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTeams = () => {
    setLoading(true); setError('')
    api.workflows(q, 1, 100).then((res) => { setTeams(res.data ?? []); setSelectedTeam(''); setFolders([]) }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }

  const openTeam = (team: string) => {
    setLoading(true); setError(''); setSelectedTeam(team)
    api.workflows(q, 1, 100, team).then((res) => setFolders(res.data ?? [])).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { loadTeams() }, [])

  if (selectedTeam) {
    return <>
      <PageHeader title={selectedTeam} description="Workflows grouped by the sub-folder from workflow metadata." action={<button className="cm-btn-secondary" onClick={loadTeams}><ArrowLeft className="h-4 w-4" /> All teams</button>} />
      {error && <ErrorBox message={error} />}
      {loading ? <Loading /> : <section className="space-y-4">{folders.length === 0 ? <div className="cm-card"><Empty text="No workflows found for this team." /></div> : folders.map((folder) => <div key={folder.name} className="cm-card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3"><div><p className="text-sm font-semibold text-slate-800">{folder.name}</p><p className="text-xs text-slate-400">Metadata sub-folder</p></div><span className="cm-badge bg-white text-slate-500 ring-1 ring-slate-200">{folder.workflowCount} workflow{folder.workflowCount === 1 ? '' : 's'}</span></div><div className="divide-y divide-slate-100">{folder.workflows.map((w) => <button key={w.branchName} onClick={() => navigate(`/mappings/${w.workflowId}`)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"><div className="min-w-0"><div className="flex items-center gap-2"><Workflow className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate font-medium text-slate-900">{w.workflowName || w.workflowId}</span></div><p className="mt-1 pl-6 font-mono text-xs text-slate-400">{w.workflowId} · {w.folderPath || 'Root'}</p></div><div className="flex shrink-0 items-center gap-3"><span className="hidden font-mono text-xs text-slate-400 md:block">{w.headSha}</span><span className="cm-badge bg-emerald-50 text-emerald-700">{w.status}</span><ArrowRight className="h-4 w-4 text-slate-300" /></div></button>)}</div></div>)}</section>}
    </>
  }

  return <>
    <PageHeader title="Workflows" description="Select a team first, then browse its workflows by metadata sub-folder." action={<div className="flex gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="cm-input pl-9 sm:w-72" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadTeams()} placeholder="Search teams..." /></div><button className="cm-btn-secondary" onClick={loadTeams}>Search</button></div>} />
    {error && <ErrorBox message={error} onRetry={loadTeams} />}
    {loading ? <Loading /> : <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{teams.length === 0 ? <div className="cm-card sm:col-span-2 xl:col-span-3"><Empty text="No teams found." /></div> : teams.map((team) => <button key={team.name} onClick={() => openTeam(team.name)} className="cm-card p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-slate-100 p-2.5 text-slate-600"><Users className="h-5 w-5" /></div><div><p className="font-semibold text-slate-900">{team.name}</p><p className="mt-1 text-xs text-slate-500">Team metadata folder</p></div></div><ArrowRight className="mt-1 h-4 w-4 text-slate-300" /></div><div className="mt-5 text-sm text-slate-500">{team.workflowCount} workflow{team.workflowCount === 1 ? '' : 's'}</div></button>)}</section>}
  </>
}

function MappingsPage({ navigate }: PageProps) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'configured' | 'not_configured'>('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 20
  const requestId = useState(() => ({ current: 0 }))[0]

  const load = (nextPage = page, nextStatus = status) => {
    const id = ++requestId.current
    setLoading(true); setError('')
    api.mappings(q, nextPage, limit, nextStatus)
      .then((res) => { if (id === requestId.current) setData(res) })
      .catch((e) => { if (id === requestId.current) setError(e.message) })
      .finally(() => { if (id === requestId.current) setLoading(false) })
  }

  useEffect(() => { load(1, 'all') }, [])

  const changeStatus = (next: 'all' | 'configured' | 'not_configured') => { setStatus(next); setPage(1); load(1, next) }
  const changePage = (next: number) => { setPage(next); load(next, status) }
  const search = () => { setPage(1); load(1, status) }
  const totalPages = Math.max(1, Math.ceil((data?.pagination?.total ?? 0) / limit))

  return <>
    <PageHeader title="Mappings" description="Review credential mapping coverage with status filtering and pagination." action={<div className="flex flex-wrap gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="cm-input pl-9 sm:w-64" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search mappings..." /></div><button className="cm-btn-secondary" onClick={search}>Search</button></div>} />
    <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-2 text-sm font-medium text-slate-600">Filter:</span>{([['all', 'All'], ['configured', 'Configured'], ['not_configured', 'Not configured']] as const).map(([value, label]) => <button key={value} onClick={() => changeStatus(value)} className={`rounded-lg px-3 py-2 text-sm font-medium ${status === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{label}</button>)}{data && <span className="ml-auto text-sm text-slate-500">{data.pagination.total} result{data.pagination.total === 1 ? '' : 's'}</span>}</div>
    {error && <ErrorBox message={error} onRetry={() => load(page, status)} />}
    {loading ? <Loading /> : <section className="cm-card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Workflow</th><th className="px-5 py-3">Team</th><th className="px-5 py-3">Entries</th><th className="px-5 py-3">Mapping</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.data.map((w: any) => <tr key={w.branchName} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-medium text-slate-900">{w.workflowName || w.workflowId}</p><p className="font-mono text-xs text-slate-400">{w.workflowId}</p></td><td className="px-5 py-4 text-slate-600">{w.teamFolder || 'Unassigned'}</td><td className="px-5 py-4 text-slate-600">{w.entryCount}</td><td className="px-5 py-4"><span className={`cm-badge ${w.mappingExists ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{w.mappingExists ? 'Configured' : 'Not configured'}</span></td><td className="px-5 py-4 text-right"><button className="cm-btn-primary" onClick={() => navigate(`/mappings/${w.workflowId}`)}>Open</button></td></tr>)}{data?.data.length === 0 && <tr><td colSpan={5}><Empty text="No mappings found." /></td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-4"><p className="text-xs text-slate-500">Page {data?.pagination?.page ?? page} of {totalPages}</p><div className="flex gap-2"><button className="cm-btn-secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button><button className="cm-btn-secondary" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button></div></div></section>}
  </>
}

function AuditPage() { const [data, setData] = useState<any>(null); const [error, setError] = useState(''); useEffect(() => { api.listAudit().then(setData).catch((e) => setError(e.message)) }, []); return <><PageHeader title="Audit Logs" description="Track mapping, synchronization, validation, and commit activity." />{error ? <ErrorBox message={error} /> : !data ? <Loading /> : <section className="cm-card overflow-hidden"><div className="divide-y divide-slate-100">{data.data.map((row: any) => <div key={row.id} className="grid gap-2 px-5 py-4 md:grid-cols-[1fr_1.5fr_auto]"><div><span className="cm-badge bg-slate-100 text-slate-700">{row.action}</span></div><div><p className="text-sm font-medium text-slate-800">{row.actorEmail}</p><p className="font-mono text-xs text-slate-400">{row.workflowId || row.branchName || 'System event'}</p></div><p className="text-xs text-slate-400 md:text-right">{new Date(row.createdAt).toLocaleString()}</p></div>)}{data.data.length === 0 && <Empty text="No audit events recorded yet." />}</div></section>}</> }

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [path, setPath] = useState(() => window.location.pathname === '/' ? '/dashboard' : window.location.pathname)
  const [selectedBranch, setSelectedBranch] = useState<BranchInfo | null>(null)
  const navigate = (next: string) => { window.history.pushState({}, '', next); setPath(next) }
  useEffect(() => { const handler = () => setPath(window.location.pathname); window.addEventListener('popstate', handler); return () => window.removeEventListener('popstate', handler) }, [])
  useEffect(() => { api.me().then((res) => { if (!res.authenticated || !res.user) { api.login(); return }; setUser(res.user) }).catch((err) => setError(err?.message ?? 'Gagal memuat session login.')).finally(() => setSessionLoading(false)) }, [])
  useEffect(() => { if (path.startsWith('/mappings/') && !selectedBranch) { const id = decodeURIComponent(path.split('/')[2] || ''); api.mappings(id, 1, 1, 'all').then((res) => { const found = res.data.find((item: any) => item.workflowId === id); if (found) setSelectedBranch(found) }).catch(() => {}) } }, [path, selectedBranch])
  if (sessionLoading) return <Loading />
  if (error) return <div className="flex min-h-screen items-center justify-center"><ErrorBox message={error} onRetry={() => api.login()} /></div>
  if (!user) return <Loading />
  const detail = path.startsWith('/mappings/') && selectedBranch
  return <div className="min-h-screen bg-slate-50"><Header user={user} /><div className="flex min-h-[calc(100vh-4rem)]"><Sidebar path={path} onNavigate={(next) => { setSelectedBranch(null); navigate(next) }} /><main className="min-w-0 flex-1 px-5 py-7 lg:px-8">{detail ? <MappingEditor branch={selectedBranch} onBack={() => { setSelectedBranch(null); navigate('/mappings') }} /> : path === '/workflows' ? <WorkflowsPage navigate={navigate} /> : path === '/mappings' ? <MappingsPage navigate={navigate} /> : path === '/audit' ? <AuditPage /> : <DashboardPage />}</main></div></div>
}
