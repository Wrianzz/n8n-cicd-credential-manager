import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { gitService } from '../git/git.service.js'

export async function registerMappingListRoutes(app: FastifyInstance) {
  app.get('/api/mappings', async (req) => {
    const query = z.object({
      q: z.string().optional(),
      status: z.enum(['all', 'configured', 'not_configured']).default('all'),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20)
    }).parse(req.query)

    const branches = await gitService.listWorkflowBranches(query.q)
    const rows = await Promise.all(branches.map(async (branch) => {
      const map = await gitService.readJsonFromBranch<{ entries?: unknown[] }>(branch.branchName, gitService.credentialMapPath(branch.workflowId))
      const entryCount = Array.isArray(map?.entries) ? map.entries.length : 0
      return { ...branch, mappingExists: entryCount > 0, entryCount }
    }))

    const filtered = rows.filter((row) => query.status === 'all' || (query.status === 'configured' ? row.mappingExists : !row.mappingExists))
    const start = (query.page - 1) * query.limit
    return {
      data: filtered.slice(start, start + query.limit),
      pagination: { page: query.page, limit: query.limit, total: filtered.length }
    }
  })
}
