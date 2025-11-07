# Astra Campaign - AI Coding Agent Instructions

## Architecture Overview

Astra Campaign is a **multi-tenant SaaS platform** for WhatsApp bulk campaigns with AI integration. The system uses **complete data isolation** per tenant (company) with PostgreSQL and Prisma ORM.

**Key Components:**
- **Backend**: Node.js 20 + Express + TypeScript + Prisma (PostgreSQL)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Socket.IO Client
- **Database**: PostgreSQL 16 with multi-tenant schema (all tables have `tenantId`)
- **Cache/Queue**: Redis 7 (unused in current implementation - prepared for future scaling)
- **Deployment**: Docker Swarm with Traefik reverse proxy
- **WhatsApp Integration**: Single provider (WAHA API only)
- **AI**: OpenAI GPT and Groq for message personalization
- **Real-time**: Socket.IO for campaign updates, notifications, and live status (fully implemented)
- **Integrations**: Chatwoot for contact import/sync

**Multi-Tenant Model:**
- `Tenant` model with `slug` (URL-friendly) and `active` flag
- `UserTenant` many-to-many junction table for user-tenant associations
- **ALL data models include `tenantId`** for row-level isolation (except `User` and `GlobalSettings`)
- Roles: `SUPERADMIN` (global access, `tenantId = null`), `ADMIN` (tenant owner), `USER` (limited access)
- `TenantQuota` enforces limits: `maxUsers`, `maxContacts`, `maxCampaigns`, `maxConnections`
- `TenantSettings` per-tenant: API keys (OpenAI/Groq), Chatwoot config, custom branding

## Critical Workflows

### Development Setup
```bash
# Backend (port 3001)
cd backend && npm install
npm run migrate:prod  # Runs: prisma migrate deploy + seed (creates superadmin@astraonline.com.br)
npm run dev           # tsx watch src/server.ts (hot reload)

# Frontend (port 3006)
cd frontend && npm install
npm run dev           # Vite dev server, proxies /api to localhost:3001

# Login credentials after seed:
# SUPERADMIN: superadmin@astraonline.com.br / Admin123
# ADMIN: admin@astraonline.com.br / Admin123
```

### Production Deployment
```bash
# Build images
cd backend && docker build -t work-backend:latest .
cd frontend && npm run build && docker build -t work-frontend:latest .

# Deploy to Docker Swarm
docker stack deploy -c docker-stack.yml work

# Monitor services
docker service ls
docker service logs -f work_backend
docker service logs -f work_frontend

# Update service
docker service update --image work-backend:new-tag work_backend
```

### Database Operations
```bash
# Generate Prisma client (run after schema changes)
npm run generate

# Create migration
npx prisma migrate dev --name descriptive_name

# Deploy migrations to production
npm run migrate  # = prisma migrate deploy

# Seed database (creates default tenant + users)
npm run seed

# Full reset (DEV ONLY - deletes all data)
npx prisma migrate reset
```

### Building
```bash
# Backend: TypeScript → dist/ (requires prisma generate first)
npm run build  # tsc

# Frontend: Vite → dist/ (includes Tailwind processing)
npm run build  # vite build --minify=false --sourcemap
```

## Project-Specific Patterns

### Tenant Isolation
- **CRITICAL**: ALL queries MUST include `tenantId`: `prisma.contact.findMany({ where: { tenantId } })`
- `authMiddleware` (backend/src/middleware/auth.ts) extracts tenant from JWT and populates `req.tenantId` and `req.tenant`
- SUPERADMIN can override tenant via `X-Tenant-Id` header for cross-tenant operations
- Routes without tenant isolation throw 401 if `req.tenant` is null (except SUPERADMIN endpoints)
- UserTenant junction table allows users to access multiple tenants

### Authentication & Authorization
- JWT stored in localStorage as `auth_token`, includes: `userId`, `email`, `role`, `tenantId`
- `authMiddleware` validates token, checks user is active, loads tenant data
- Role hierarchy: `SUPERADMIN` (tenantId = null, global access) > `ADMIN` (tenant owner) > `USER` (limited)
- Frontend: `AuthContext` manages auth state, `useAuth()` hook for components
- Token includes in all API requests via `Authorization: Bearer <token>` header
- Protected routes check `user.role` and redirect accordingly

### WhatsApp Integration
- **Single provider**: WAHA only (WhatsApp HTTP API)
- Each session has `name` (unique, API identifier) and `displayName` (user-friendly label)
- QR codes expire after 60 seconds, auto-refresh in frontend
- Multi-session campaigns distribute messages round-robin via `campaignSessionIndexes` Map
- Service: `wahaApiService.ts` - all WhatsApp communication via WAHA API
- Session status: `ONLINE`, `OFFLINE`, `STARTING`, `SCAN_QR` - real-time via WebSocket
- WebSocket events: `session:status` broadcasts session state changes to all tenant users

### Campaign Execution
- `CampaignSchedulerService` polls every 30s for PENDING/RUNNING campaigns
- Business hours support: campaigns pause outside configured hours (including lunch breaks)
- Interval-based processing (not Redis queues) - single message per cycle to avoid rate limits
- Real-time updates via `websocketService.notifyCampaignUpdate(campaignId, data)`
- Message randomization: multiple texts/images/videos selected per contact
- AI generation: `openaiService` (GPT) or `groqService` (fast inference) for dynamic content
- Variables: `{{nome}}`, `{{telefone}}`, `{{email}}`, `{{categoria}}`, `{{observacoes}}`
- Status flow: PENDING → RUNNING → COMPLETED (or PAUSED/FAILED)

### Real-time WebSocket (Frontend + Backend)
- **Backend**: `websocketService.ts` - Socket.IO server with JWT authentication
- **Frontend**: `services/websocket.ts` - Socket.IO client with auto-reconnect
- **Hook**: `useWebSocket()` - React hook for components to subscribe to events
- **Connection**: Auto-connects on app load, uses JWT from localStorage
- **Events**:
  - `campaign:update` - Campaign progress updates (sent, failed, completed counts)
  - `campaign:{id}` - Specific campaign updates
  - `notification` - System notifications for users
  - `session:status` - WhatsApp session status changes
- **Rooms**: Users auto-join `tenant_{tenantId}` room for scoped broadcasts
- **Helpers**: `subscribeToCampaign(id, callback)`, `onNotification(callback)`, `onSessionUpdate(callback)`
- **Usage Example**:
  ```tsx
  const { subscribeToCampaign } = useWebSocket();
  useEffect(() => {
    const unsubscribe = subscribeToCampaign(campaignId, (data) => {
      setCampaignStats(data);
    });
    return unsubscribe;
  }, [campaignId]);
  ```

### File Structure Conventions
```
backend/src/
├── controllers/     # Business logic, tenant-aware
├── routes/         # Express routes with middleware
├── services/       # Core business services
├── middleware/     # Auth, tenant, quota checks
├── types/          # TypeScript interfaces
└── server.ts       # Express app setup

frontend/src/
├── components/     # Reusable React components
├── pages/         # Route-based page components
├── services/      # API client functions
├── hooks/         # Custom React hooks
├── contexts/      # React context providers
└── types/         # Shared TypeScript types
```

### Error Handling
- Use `express-validator` for input validation (check/validationResult pattern)
- **Quota errors** set `upgradeRequired: true` flag for frontend upgrade prompts
- Frontend API service (api.ts) detects quota errors via `isQuotaError` flag
- Return structured: `{ success: false, message: string, errors?: any[] }`
- Log errors with tenant/user context for audit trail
- Timeout: 30s fetch with AbortController to prevent 524 gateway timeouts

### API Response Format
```typescript
// Success
{ success: true, data: T, message?: string }

// Error (standard)
{ success: false, message: string, errors?: ValidationError[] }

// Error (quota exceeded - triggers upgrade modal)
{ success: false, message: "Limite atingido", upgradeRequired: true }
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection (must include `?schema=public`)
- `JWT_SECRET`: 32+ character secret (critical for security)
- `JWT_EXPIRES_IN`: Token expiration (default: `24h`)
- `REDIS_URL`: Redis connection (unused but required for future features)
- `DEFAULT_WAHA_HOST/API_KEY`: WAHA provider defaults (can be empty)
- `DEFAULT_CHATWOOT_URL/TOKEN`: Chatwoot integration defaults
- `ALLOWED_ORIGINS`: CORS origins (comma-separated, include frontend URL)
- `NODE_ENV`: `production` or `development` (affects error verbosity)

## Integration Points

### External APIs
- **WAHA API**: WhatsApp Web automation (single provider)
- **Chatwoot API**: Contact import/sync from customer support platform
- **OpenAI API**: GPT-4/3.5-turbo for message content generation
- **Groq API**: Fast LLM inference (Llama models) for real-time AI

### Cross-Component Communication
- **WebSocket**: Real-time campaign updates (`/socket.io`), auth via JWT token in handshake
  - `notifyCampaignUpdate(campaignId, data)` - broadcast to all campaign viewers
  - `notifyTenant(tenantId, notification)` - broadcast to all tenant users
  - `notifyUser(userId, notification)` - send to specific user
- **Redis**: Prepared infrastructure (not actively used - replaced by interval polling)
- **Prisma**: Type-safe ORM, custom middleware for soft deletes and audit trails
- **Multer**: File uploads to `/tmp/uploads` then moved to `/app/uploads`
- **Socket.IO Rooms**: Users auto-join tenant rooms for scoped broadcasting

## Common Pitfalls

- **Tenant Context**: Always check `req.tenant` exists before operations (except SUPERADMIN routes)
- **Session Management**: WhatsApp sessions are tenant-scoped - use `name` for API, `displayName` for UI
- **File Paths**: Use absolute paths - `/app/uploads`, `/app/backups`, `/tmp/uploads` (temp)
- **CORS**: Configure `ALLOWED_ORIGINS` for frontend domain (comma-separated for multiple)
- **Migrations**: Run `prisma generate` after schema changes BEFORE `npm run build`
- **Dependencies**: Backend uses `tsx` for dev (hot reload), `node` for production
- **Port Conflicts**: Backend 3001, Frontend 3006 (dev) / 80 (prod via Nginx)
- **Prisma Binary Targets**: Dockerfile includes `linux-musl-openssl-3.0.x` for Alpine Linux
- **Business Hours**: Stored in HH:MM format (24h), validated per day-of-week
- **Multi-Session**: Use `sessionNames` (JSON string) not `sessionName` for campaigns with multiple sessions

## Key Files to Reference

- `backend/prisma/schema.prisma`: Database schema and relations
- `backend/src/middleware/auth.ts`: Authentication and tenant extraction
- `backend/src/services/campaignSchedulerService.ts`: Campaign execution
- `backend/src/services/websocketService.ts`: Real-time Socket.IO server
- `frontend/src/services/api.ts`: API client configuration
- `frontend/src/services/websocket.ts`: WebSocket client service
- `frontend/src/hooks/useWebSocket.ts`: React hooks for real-time events
- `docker-stack.yml`: Production deployment config