import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { gitService } from '../git/git.service.js'

type WorkflowFolder = {
  name: string
  workflowCount: number
  workflows: Awaited<ReturnType<typeof gitService.listWorkflowBranches>>
  children: WorkflowFolder[]
}

export async function registerWorkflowRoutes(app: FastifyInstance) {
  app.get('/api/workflows', async (req) => {
    const query = z.object({
      q: z.string().optional(),
      team: z.string().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20)
    }).parse(req.query)

    const branches = await gitService.listWorkflowBranches(query.q)
    const grouped = new Map<string, typeof branches>()
    for (const branch of branches) {
      const team = branch.teamFolder ?? 'Unassigned'
      const rows = grouped.get(team) ?? []
      rows.push(branch)
      grouped.set(team, rows)
    }

    const teams = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, workflows]) => ({ name, workflowCount: workflows.length }))

    if (!query.team) {
      const start = (query.page - 1) * query.limit
      return {
        data: teams.slice(start, start + query.limit),
        pagination: { page: query.page, limit: query.limit, total: teams.length },
        workflowTotal: branches.length
      }
    }

    const teamWorkflows = grouped.get(query.team) ?? []
    const rootFolders = new Map<string, WorkflowFolder>()

    for (const workflow of teamWorkflows) {
      const segments = workflow.folderPath?.split('/').map((segment) => segment.trim()).filter(Boolean) ?? []
      const folderSegments = segments.length > 1 ? segments.slice(1) : []

      if (folderSegments.length === 0) {
        const root = rootFolders.get('Root') ?? { name: 'Root', workflowCount: 0, workflows: [], children: [] }
        root.workflows.push(workflow)
        root.workflowCount += 1
        rootFolders.set('Root', root)
        continue
      }

      let current: WorkflowFolder | undefined = rootFolders.get(folderSegments[0])
      if (!current) {
        current = { name: folderSegments[0], workflowCount: 0, workflows: [], children: [] }
        rootFolders.set(folderSegments[0], current)
      }

      current.workflowCount += 1
      if (folderSegments.length === 1) {
        current.workflows.push(workflow)
        continue
      }

      for (let index = 1; index < folderSegments.length; index += 1) {
        const segment = folderSegments[index]
        let child: WorkflowFolder | undefined = current.children.find((item) => item.name === segment)
        if (!child) {
          child = { name: segment, workflowCount: 0, workflows: [], children: [] }
          current.children.push(child)
        }
        child.workflowCount += 1
        current = child
        if (index === folderSegments.length - 1) current.workflows.push(workflow)
      }
    }

    const sortFolders = (items: WorkflowFolder[]): WorkflowFolder[] => items
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ ...folder, children: sortFolders(folder.children) }))

    const data = sortFolders([...rootFolders.values()])
    const start = (query.page - 1) * query.limit

    return {
      team: query.team,
      data: data.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total: data.length },
      workflowTotal: teamWorkflows.length
    }
  })
}
