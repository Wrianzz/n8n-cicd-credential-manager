import type { FastifyInstance } from 'fastify'
import { auditService } from '../audit/audit.service.js'
import { gitService } from '../git/git.service.js'

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get('/api/dashboard', async () => {
    const branches = await gitService.listWorkflowBranches()
    const teams = new Set(branches.map((branch) => branch.teamFolder).filter(Boolean))
    const mappingRows = await Promise.all(branches.map(async (branch) => {
      const map = await gitService.readJsonFromBranch<{ entries?: unknown[] }>(branch.branchName, gitService.credentialMapPath(branch.workflowId))
      return Array.isArray(map?.entries) && map.entries.length > 0
    }))
    const configuredMappings = mappingRows.filter(Boolean).length
    const audit = auditService.list({ page: 1, limit: 8 })

    return {
      summary: {
        teams: teams.size,
        workflows: branches.length,
        mappings: configuredMappings,
        active: branches.length,
        attention: branches.length - configuredMappings
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
