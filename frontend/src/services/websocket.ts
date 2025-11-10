import { io, Socket } from 'socket.io-client';

interface WebSocketServiceInterface {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
}

class WebSocketService implements WebSocketServiceInterface {
  socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  connect(): void {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      console.warn('⚠️ No auth token found, cannot connect to WebSocket');
      return;
    }

    // URL do WebSocket (usar mesma origem em produção)
    const wsUrl = import.meta.env.PROD 
      ? window.location.origin 
      : 'http://localhost:3001';

    console.log('🔌 Connecting to WebSocket:', wsUrl);

    this.socket = io(wsUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      auth: {
        token
      },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      
      // Auto-reconnect if not a manual disconnect
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt reconnect
        console.log('🔄 Attempting to reconnect...');
        setTimeout(() => this.connect(), this.reconnectDelay);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnect attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Eventos de negócio
    this.socket.on('campaign:update', (data) => {
      console.log('📢 Campaign update received:', data);
    });

    this.socket.on('campaign_progress', (data) => {
      console.log('📊 Campaign progress received (websocket service):', data);
    });

    this.socket.on('notification', (data) => {
      console.log('🔔 Notification received:', data);
    });

    this.socket.on('session:status', (data) => {
      console.log('📱 Session status update:', data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      console.warn(`⚠️ Cannot listen to event "${event}" - socket not connected`);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    } else {
      console.warn(`⚠️ Cannot emit event "${event}" - socket not connected`);
    }
  }

  // Método helper para se inscrever em atualizações de campanha
  subscribeToCampaign(campaignId: string, callback: (data: any) => void): () => void {
    const event = `campaign:${campaignId}`;
    this.on(event, callback);
    
    // Retorna função de unsubscribe
    return () => this.off(event, callback);
  }

  // Método helper para notificações
  onNotification(callback: (notification: any) => void): () => void {
    this.on('notification', callback);
    return () => this.off('notification', callback);
  }

  // Método helper para atualizações de sessão
  onSessionUpdate(callback: (data: any) => void): () => void {
    this.on('session:status', callback);
    return () => this.off('session:status', callback);
  }
}

// Exportar instância singleton
export const websocketService = new WebSocketService();

// Exportar tipo para uso em hooks
export type { WebSocketServiceInterface };
