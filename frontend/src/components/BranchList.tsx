import { ChevronDown, ChevronRight, Folder, FolderOpen, RefreshCcw, Search, Workflow } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { BranchInfo } from '../types'

type Props = {
  onOpen: (branch: BranchInfo) => void
}

type FolderNode = {
  id: string
  name: string
  branches: BranchInfo[]
  children: FolderNode[]
}

const UNGROUPED_FOLDER = 'Tanpa Folder'

function folderSegments(branch: BranchInfo) {
  const segments = branch.folderPath?.split('/').map((segment) => segment.trim()).filter(Boolean) ?? []
  return segments.length > 0 ? segments : [UNGROUPED_FOLDER]
}

function createFolderNode(id: string, name: string): FolderNode {
  return { id, name, branches: [], children: [] }
}

function countWorkflows(node: FolderNode): number {
  return node.branches.length + node.children.reduce((total, child) => total + countWorkflows(child), 0)
}

export function BranchList({ onOpen }: Props) {
  const [q, setQ] = useState('')
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => new Set())

  const folderTree = useMemo(() => {
    const root = createFolderNode('', '')

    branches.forEach((branch) => {
      let current = root
      let currentPath = ''

      folderSegments(branch).forEach((segment) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment
        let child = current.children.find((item) => item.name === segment)

        if (!child) {
          child = createFolderNode(currentPath, segment)
          current.children.push(child)
        }

        current = child
      })

      current.branches.push(branch)
    })

    const sortTree = (node: FolderNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name))
      node.branches.sort((a, b) => (a.workflowName || a.workflowId).localeCompare(b.workflowName || b.workflowId))
      node.children.forEach(sortTree)
    }

    sortTree(root)
    return root.children
  }, [branches])

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.listBranches(q)
      setBranches(result.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function sync() {
    setLoading(true)
    setError(null)
    try {
      await api.syncBranches()
      await load()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderFolder = (node: FolderNode, depth = 0): JSX.Element => {
    const isCollapsed = collapsedFolders.has(node.id)
    const workflowCount = countWorkflows(node)
    const hasChildren = node.children.length > 0 || node.branches.length > 0

    return (
      <Fragment key={node.id}>
        <tr className="bg-slate-50">
          <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600" colSpan={5}>
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => hasChildren && toggleFolder(node.id)}
              style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              {isCollapsed ? <Folder className="h-4 w-4 text-slate-400" /> : <FolderOpen className="h-4 w-4 text-slate-400" />}
              {node.name}
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">{workflowCount} workflow</span>
            </button>
          </td>
        </tr>

        {!isCollapsed && node.branches.map((branch) => (
          <tr key={branch.branchName} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-medium text-slate-900">
              <div className="flex items-center gap-2" style={{ paddingLeft: `${(depth + 1) * 1.25}rem` }}>
                <Workflow className="h-4 w-4 text-slate-400" />
                {branch.branchName}
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="font-medium text-slate-900">{branch.workflowName || branch.workflowId}</div>
              <div className="font-mono text-xs text-slate-500">{branch.workflowId}</div>
            </td>
            <td className="px-5 py-4 font-mono text-xs text-slate-600">{branch.headSha}</td>
            <td className="px-5 py-4">
              <span className="cm-badge bg-emerald-100 text-emerald-700">{branch.status}</span>
            </td>
            <td className="px-5 py-4 text-right">
              <button className="cm-btn-primary" onClick={() => onOpen(branch)}>Open Mapping Editor</button>
            </td>
          </tr>
        ))}
        {!isCollapsed && node.children.map((child) => renderFolder(child, depth + 1))}
      </Fragment>
    )
  }

  return (
    <div className="space-y-6">
      <section className="cm-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Branch List</h2>
            <p className="text-sm text-slate-500">Hanya branch dengan prefix workflow/* yang ditampilkan dalam tree folder metadata.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="cm-input pl-9 sm:w-80"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && load()}
                placeholder="Search workflow, folder, branch..."
              />
            </div>
            <button className="cm-btn-secondary" onClick={load} disabled={loading}>Search</button>
            <button className="cm-btn-primary" onClick={sync} disabled={loading}>
              <RefreshCcw className="h-4 w-4" /> Sync from repo
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}
      </section>

      <section className="cm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Workflow</th>
                <th className="px-5 py-3">Head SHA</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {folderTree.map((node) => renderFolder(node))}

              {!loading && branches.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={5}>
                    Tidak ada branch workflow/* ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}