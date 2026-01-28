import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
// import rateLimit from 'express-rate-limit'; // Temporariamente desabilitado
import * as fs from 'fs';
import * as path from 'path';
import { contactRoutes } from './routes/contactRoutes';
import { categoryRoutes } from './routes/categoryRoutes';
import { mockRoutes } from './routes/mockRoutes';
import { csvImportRoutes } from './routes/csvImportRoutes';
import wahaRoutes from './routes/waha';
import campaignRoutes from './routes/campaigns';
import settingsRoutes from './routes/settingsRoutes';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import mediaRoutes from './routes/mediaRoutes';
import tenantRoutes from './routes/tenants';
import userTenantsRoutes from './routes/userTenants';
import { systemRoutes } from './routes/system';
import alertsRoutes from './routes/alerts';
import analyticsRoutes from './routes/analytics';
import notificationsRoutes from './routes/notifications';
import messageTemplatesRoutes from './routes/messageTemplates';
import reportsRoutes from './routes/reports';
import automationRoutes from './routes/automation';
import chatwootRoutes from './routes/chatwootRoutes';
import connectionRoutes from './routes/connectionRoutes';
import webhookRoutes from './routes/webhookRoutes';
import incomingWebhookRoutes from './routes/incomingWebhookRoutes';
import interactiveCampaignRoutes from './routes/interactiveCampaignRoutes';
import httpProxyRoutes from './routes/httpProxyRoutes';
// import integrationsRoutes from './routes/integrations';
// import cacheRoutes from './routes/cache';
import { authMiddleware } from './middleware/auth';
import './services/campaignSchedulerService'; // Inicializar scheduler
import { initializeAlertsMonitoring } from './services/alertsMonitoringService'; // Inicializar monitoramento de alertas
import { websocketService } from './services/websocketService'; // Inicializar WebSocket
import { automationService } from './services/automationService'; // Inicializar automação

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Configurar para confiar no proxy (nginx/traefik) - apenas no primeiro proxy
app.set('trust proxy', 1);

// Criar diretório para uploads temporários
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// CORS configurado para permitir qualquer origem (frontend e backend juntos)
const corsOptions = {
  origin: true, // Permitir qualquer origem
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting temporariamente desabilitado devido a problemas com trust proxy
/*
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // limite de 1000 requests por IP por janela de tempo
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // limite de 10 tentativas de login por IP
  message: {
    error: 'Muitas tentativas de login, tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // limite de 20 requisições IA por minuto
  message: {
    error: 'Muitas requisições para IA, tente novamente em 1 minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
*/

// Temporariamente desabilitado devido a problemas com trust proxy
// app.use(generalLimiter);

// Middleware para todas as rotas exceto upload
app.use((req, res, next) => {
  if (req.path.includes('/media/upload')) {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.includes('/media/upload')) {
    return next();
  }
  express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
});

// Rotas públicas (autenticação) - rate limiting temporariamente desabilitado
app.use('/api/auth', authRoutes);

// Rota pública para configurações (favicon e título)
app.use('/api/settings', settingsRoutes);

// Health check público
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Servir uploads estaticamente (público)
app.use('/api/uploads', express.static('/app/uploads'));

// Rotas públicas de webhooks (recebem de provedores externos)
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhooks', incomingWebhookRoutes);

// Rotas protegidas (requerem autenticação)
app.use('/api/contatos', authMiddleware, contactRoutes);
app.use('/api/categorias', authMiddleware, categoryRoutes);
app.use('/api/csv', authMiddleware, csvImportRoutes);
app.use('/api/waha', authMiddleware, wahaRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/tenants', authMiddleware, tenantRoutes); // SUPERADMIN only
app.use('/api/user-tenants', authMiddleware, userTenantsRoutes);
app.use('/api/system', authMiddleware, systemRoutes); // SUPERADMIN only - System stats and monitoring
app.use('/api/alerts', authMiddleware, alertsRoutes); // Alerts management
app.use('/api/analytics', authMiddleware, analyticsRoutes); // Analytics and reporting per tenant
app.use('/api/notifications', authMiddleware, notificationsRoutes); // User notifications
app.use('/api/templates', authMiddleware, messageTemplatesRoutes); // Message templates system
app.use('/api/reports', authMiddleware, reportsRoutes); // Advanced reporting system
app.use('/api/automation', authMiddleware, automationRoutes); // Automation and workflow system

// Middleware de log para debug do Chatwoot
app.use('/api/chatwoot', (req, res, next) => {
  console.log(`🔍 [CHATWOOT] ${req.method} ${req.path} - ContentType: ${req.headers['content-type']}`);
  next();
});

app.use('/api/chatwoot', authMiddleware, chatwootRoutes); // Chatwoot integration
// app.use('/api/integrations', integrationsRoutes); // External API integrations system
// app.use('/api/cache', cacheRoutes); // Cache management and monitoring
app.use('/api/media', authMiddleware, mediaRoutes); // Upload de arquivos de mídia
app.use('/api/connections', authMiddleware, connectionRoutes); // Interactive campaigns - Connections
app.use('/api/interactive-campaigns', authMiddleware, interactiveCampaignRoutes); // Interactive campaigns
app.use('/api/http-proxy', authMiddleware, httpProxyRoutes); // HTTP REST proxy to avoid CORS
app.use('/api', authMiddleware, mockRoutes);

// Catch-all para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize WebSocket service
  websocketService.initialize(server);

  // Initialize alerts monitoring service
  initializeAlertsMonitoring();
});