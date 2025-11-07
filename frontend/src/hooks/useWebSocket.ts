import { useEffect, useState, useCallback } from 'react';
import { websocketService } from '../services/websocket';

interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => void;
  subscribeToCampaign: (campaignId: string, callback: (data: any) => void) => () => void;
  onNotification: (callback: (notification: any) => void) => () => void;
  onSessionUpdate: (callback: (data: any) => void) => () => void;
}

/**
 * Hook para usar WebSocket em componentes React
 * 
 * @example
 * ```tsx
 * const { isConnected, subscribeToCampaign } = useWebSocket();
 * 
 * useEffect(() => {
 *   if (!campaignId) return;
 *   
 *   const unsubscribe = subscribeToCampaign(campaignId, (data) => {
 *     console.log('Campaign update:', data);
 *     setCampaign(data);
 *   });
 *   
 *   return unsubscribe;
 * }, [campaignId]);
 * ```
 */
export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(websocketService.isConnected());

  useEffect(() => {
    // Conectar ao WebSocket quando o componente montar
    websocketService.connect();

    // Listener para mudanças de status de conexão
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    websocketService.on('connect', handleConnect);
    websocketService.on('disconnect', handleDisconnect);

    // Cleanup ao desmontar
    return () => {
      websocketService.off('connect', handleConnect);
      websocketService.off('disconnect', handleDisconnect);
      // Não desconectar o socket aqui, pois outros componentes podem estar usando
    };
  }, []);

  const subscribe = useCallback((event: string, callback: (...args: any[]) => void) => {
    websocketService.on(event, callback);
    return () => websocketService.off(event, callback);
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    websocketService.emit(event, ...args);
  }, []);

  const subscribeToCampaign = useCallback((campaignId: string, callback: (data: any) => void) => {
    return websocketService.subscribeToCampaign(campaignId, callback);
  }, []);

  const onNotification = useCallback((callback: (notification: any) => void) => {
    return websocketService.onNotification(callback);
  }, []);

  const onSessionUpdate = useCallback((callback: (data: any) => void) => {
    return websocketService.onSessionUpdate(callback);
  }, []);

  return {
    isConnected,
    subscribe,
    emit,
    subscribeToCampaign,
    onNotification,
    onSessionUpdate,
  };
}

/**
 * Hook para escutar notificações em tempo real
 * 
 * @example
 * ```tsx
 * useWebSocketNotifications((notification) => {
 *   toast(notification.message, { type: notification.type });
 * });
 * ```
 */
export function useWebSocketNotifications(callback: (notification: any) => void) {
  const { onNotification } = useWebSocket();

  useEffect(() => {
    const unsubscribe = onNotification(callback);
    return unsubscribe;
  }, [callback, onNotification]);
}

/**
 * Hook para monitorar campanha em tempo real
 * 
 * @example
 * ```tsx
 * const campaign = useWebSocketCampaign(campaignId);
 * ```
 */
export function useWebSocketCampaign(campaignId: string | undefined) {
  const { subscribeToCampaign } = useWebSocket();
  const [campaignData, setCampaignData] = useState<any>(null);

  useEffect(() => {
    if (!campaignId) return;

    const unsubscribe = subscribeToCampaign(campaignId, (data) => {
      console.log('📊 Campaign data updated:', data);
      setCampaignData(data);
    });

    return unsubscribe;
  }, [campaignId, subscribeToCampaign]);

  return campaignData;
}

/**
 * Hook para monitorar status de sessões WhatsApp em tempo real
 * 
 * @example
 * ```tsx
 * useWebSocketSessions((sessionData) => {
 *   console.log('Session updated:', sessionData);
 *   updateSessionInList(sessionData);
 * });
 * ```
 */
export function useWebSocketSessions(callback: (data: any) => void) {
  const { onSessionUpdate } = useWebSocket();

  useEffect(() => {
    const unsubscribe = onSessionUpdate(callback);
    return unsubscribe;
  }, [callback, onSessionUpdate]);
}
