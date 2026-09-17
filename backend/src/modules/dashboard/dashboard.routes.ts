import type { FastifyInstance } from 'fastify'
import { auditService } from '../audit/audit.service.js'
import { draftService } from '../drafts/draft.service.js'
import { gitService } from '../git/git.service.js'

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', async () => {
    const branches = await gitService.listWorkflowBranches()
    const teams = new Set(branches.map((branch) => branch.teamFolder).filter(Boolean))
    const audit = auditService.list({ page: 1, limit: 8 })
    const drafts = draftService.list({ page: 1, limit: 100 })

    return {
      summary: {
        teams: teams.size,
        workflows: branches.length,
        mappings: branches.length,
        drafts: drafts.pagination.total,
        active: branches.length,
        attention: drafts.pagination.total
      },
      recentActivity: audit.data,
      repository: {
        remote: gitService.getRemoteName(),
        workflowCount: branches.length,
        teamCount: teams.size,
        syncedAt: new Date().toISOString()
      }
    }
  })
}
