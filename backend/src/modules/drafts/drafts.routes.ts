import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { draftService } from './draft.service.js'

export async function registerDraftRoutes(app: FastifyInstance) {
  app.get('/api/drafts', async (req) => {
    const query = z.object({
      status: z.enum(['draft', 'committed', 'discarded']).optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20)
    }).parse(req.query)

    return draftService.list(query)
  })

  app.get('/api/drafts/:draftId', async (req, reply) => {
    const { draftId } = z.object({ draftId: z.string() }).parse(req.params)
    const draft = draftService.get(draftId)
    if (!draft) return reply.code(404).send({ error: { code: 'DRAFT_NOT_FOUND', message: `Draft ${draftId} tidak ditemukan.` } })
    return draft
  })
}
