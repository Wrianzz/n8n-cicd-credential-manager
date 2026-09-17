import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { registerAuth } from './plugins/auth.js'
import { registerErrorHandler } from './plugins/error-handler.js'
import { registerAuditRoutes } from './modules/audit/audit.routes.js'
import { registerBranchRoutes } from './modules/branches/branches.routes.js'
import { registerMapRoutes } from './modules/maps/maps.routes.js'
import { registerMappingListRoutes } from './modules/maps/mappings.routes.js'
import { registerDraftRoutes } from './modules/drafts/drafts.routes.js'
import { registerWorkflowRoutes } from './modules/workflows/workflows.routes.js'
import { registerDashboardRoutes } from './modules/dashboard/dashboard.routes.js'
import { registerRepositoryRoutes } from './modules/repository/repository.routes.js'

const app = Fastify({ logger: true, genReqId: () => `trc_${randomUUID()}` })
app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
  try { done(null, Object.fromEntries(new URLSearchParams(String(body)).entries())) } catch (error) { done(error as Error) }
})
await app.register(cors, { origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()), credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] })
await app.register(cookie, { secret: config.SESSION_COOKIE_SECRET || 'dev-only-cookie-secret-change-this-please' })
await registerErrorHandler(app)
app.get('/healthz', async (req) => ({ ok: true, traceId: req.id }))
await registerAuth(app)
await registerDashboardRoutes(app)
await registerWorkflowRoutes(app)
await registerMappingListRoutes(app)
await registerDraftRoutes(app)
await registerRepositoryRoutes(app)
await registerBranchRoutes(app)
await registerMapRoutes(app)
await registerAuditRoutes(app)
await app.listen({ port: config.PORT, host: config.HOST })
