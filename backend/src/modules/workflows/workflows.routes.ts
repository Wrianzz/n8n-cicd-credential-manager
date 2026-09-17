import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { gitService } from '../git/git.service.js'

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
    const folders = new Map<string, typeof teamWorkflows>()
    for (const workflow of teamWorkflows) {
      const segments = workflow.folderPath?.split('/').map((segment) => segment.trim()).filter(Boolean) ?? []
      const subfolder = segments.length > 1 ? segments.slice(1).join('/') : 'Root'
      const rows = folders.get(subfolder) ?? []
      rows.push(workflow)
      folders.set(subfolder, rows)
    }

    const data = [...folders.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, workflows]) => ({ name, workflowCount: workflows.length, workflows }))

    const start = (query.page - 1) * query.limit
    return {
      team: query.team,
      data: data.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total: data.length },
      workflowTotal: teamWorkflows.length
    }
  })
}
