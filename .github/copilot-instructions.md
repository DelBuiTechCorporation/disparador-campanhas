# Astra Campaign - AI Coding Agent Instructions

## Architecture Overview

Astra Campaign is a multi-tenant SaaS platform for WhatsApp bulk campaigns with AI integration. The system uses complete data isolation per tenant (company) with PostgreSQL and Prisma ORM.

**Key Components:**
- **Backend**: Node.js 20 + Express + TypeScript + Prisma (PostgreSQL)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Database**: PostgreSQL 16 with multi-tenant schema
- **Cache/Queue**: Redis 7
- **Deployment**: Docker Swarm with Traefik reverse proxy
- **WhatsApp Integration**: Dual providers (WAHA API, Evolution API)
- **AI**: OpenAI GPT and Groq for message personalization

**Multi-Tenant Model:**
- `Tenant` model with slug-based isolation
- `UserTenant` many-to-many for user access across tenants
- All data models include `tenantId` for row-level isolation
- Roles: SUPERADMIN (global), ADMIN (tenant), USER (limited)

## Critical Workflows

### Development Setup
```bash
# Backend
cd backend && npm install
npm run migrate:prod  # Runs Prisma migrations + seed
npm run dev           # tsx watch src/server.ts

# Frontend  
cd frontend && npm install
npm run dev           # Vite dev server on port 3006, proxies /api to localhost:3003
```

### Production Deployment
```bash
# Docker Swarm
docker stack deploy -c docker-stack.yml work

# Check services
docker service ls
docker service logs -f work_backend
```

### Database Operations
```bash
# Generate Prisma client
npm run generate

# Create migration
npx prisma migrate dev --name <migration_name>

# Deploy migrations
npm run migrate

# Reset database
npx prisma migrate reset
```

### Building
```bash
# Backend
npm run build  # tsc -> dist/

# Frontend
npm run build  # vite build -> dist/
```

## Project-Specific Patterns

### Tenant Isolation
- **Always** include `tenantId` in queries: `prisma.contact.findMany({ where: { tenantId } })`
- Use `tenantMiddleware` in routes for automatic tenant context
- SUPERADMIN routes bypass tenant isolation
- Validate tenant access in controllers

### Authentication & Authorization
- JWT tokens include `tenantId` and `role`
- `authMiddleware` extracts user context from JWT
- Role hierarchy: SUPERADMIN > ADMIN > USER
- Use `req.user` for current user, `req.tenant` for current tenant

### WhatsApp Integration
- Dual provider support: WAHA (QR-based) and Evolution API
- Sessions stored per tenant with provider type
- Automatic failover between sessions
- Rate limiting with configurable delays

### Campaign Execution
- Asynchronous processing via Redis queues
- Real-time updates via Socket.IO
- Randomization: texts, media, delays
- AI personalization using OpenAI/Groq APIs

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
- Use `express-validator` for input validation
- Return structured errors: `{ success: false, message: string, errors?: any[] }`
- Log errors with context (user, tenant, operation)

### API Response Format
```typescript
// Success
{ success: true, data: T, message?: string }

// Error
{ success: false, message: string, errors?: ValidationError[] }
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: 32+ character secret
- `REDIS_URL`: Redis connection
- `DEFAULT_WAHA_HOST/API_KEY`: WhatsApp provider defaults
- `ALLOWED_ORIGINS`: CORS origins (include frontend URL)

## Integration Points

### External APIs
- **WAHA API**: WhatsApp Web automation
- **Evolution API**: Alternative WhatsApp provider
- **OpenAI API**: GPT for content generation
- **Groq API**: Fast AI inference

### Cross-Component Communication
- **WebSocket**: Real-time campaign updates (`/socket.io`)
- **Redis**: Caching, queues, pub/sub
- **Prisma**: Type-safe database operations
- **Multer**: File uploads (contacts CSV, media)

## Common Pitfalls

- **Tenant Context**: Always check `req.tenant` exists before operations
- **Session Management**: WhatsApp sessions are tenant-scoped
- **File Paths**: Use absolute paths for uploads/backups
- **CORS**: Configure `ALLOWED_ORIGINS` for frontend domain
- **Migrations**: Run `prisma generate` after schema changes
- **Dependencies**: Backend uses `tsx` for TypeScript execution in dev

## Key Files to Reference

- `backend/prisma/schema.prisma`: Database schema and relations
- `backend/src/middleware/tenant.ts`: Tenant isolation logic
- `backend/src/services/campaignSchedulerService.ts`: Campaign execution
- `frontend/src/services/api.ts`: API client configuration
- `docker-stack.yml`: Production deployment config