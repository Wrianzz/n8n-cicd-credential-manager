import type { FastifyInstance } from 'fastify'
import { gitService } from '../git/git.service.js'

export async function registerRepositoryRoutes(app: FastifyInstance) {
  app.get('/api/repository', async () => {
    const workflows = await gitService.listWorkflowBranches()
    const teams = new Set(workflows.map((workflow) => workflow.teamFolder).filter(Boolean))
    return {
      remote: gitService.getRemoteName(),
      workflowCount: workflows.length,
      teamCount: teams.size,
      workflowBranchCount: workflows.length,
      status: 'connected',
      syncedAt: new Date().toISOString()
    }
  })
}
