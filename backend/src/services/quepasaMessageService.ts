import { settingsService } from './settingsService';

/**
 * Detecta o mimetype baseado na URL do arquivo
 */
function detectMimeType(url: string): string {
  const urlLower = url.toLowerCase();

  // Imagens
  if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) return 'image/jpeg';
  if (urlLower.endsWith('.png')) return 'image/png';
  if (urlLower.endsWith('.gif')) return 'image/gif';
  if (urlLower.endsWith('.webp')) return 'image/webp';
  if (urlLower.endsWith('.bmp')) return 'image/bmp';

  // Vídeos
  if (urlLower.endsWith('.mp4')) return 'video/mp4';
  if (urlLower.endsWith('.avi')) return 'video/x-msvideo';
  if (urlLower.endsWith('.mov')) return 'video/quicktime';
  if (urlLower.endsWith('.wmv')) return 'video/x-ms-wmv';
  if (urlLower.endsWith('.flv')) return 'video/x-flv';
  if (urlLower.endsWith('.mkv')) return 'video/x-matroska';
  if (urlLower.endsWith('.webm')) return 'video/webm';

  // Áudios
  if (urlLower.endsWith('.mp3')) return 'audio/mpeg';
  if (urlLower.endsWith('.ogg')) return 'audio/ogg';
  if (urlLower.endsWith('.wav')) return 'audio/wav';
  if (urlLower.endsWith('.m4a')) return 'audio/mp4';
  if (urlLower.endsWith('.aac')) return 'audio/aac';
  if (urlLower.endsWith('.opus')) return 'audio/opus';

  // Documentos
  if (urlLower.endsWith('.pdf')) return 'application/pdf';
  if (urlLower.endsWith('.doc')) return 'application/msword';
  if (urlLower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (urlLower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (urlLower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (urlLower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (urlLower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (urlLower.endsWith('.txt')) return 'text/plain';
  if (urlLower.endsWith('.csv')) return 'text/csv';
  if (urlLower.endsWith('.zip')) return 'application/zip';
  if (urlLower.endsWith('.rar')) return 'application/x-rar-compressed';

  // Default
  return 'application/octet-stream';
}

/**
 * Verifica se um número existe no WhatsApp via Quepasa
 */
export async function checkContactExistsQuepasa(sessionName: string, phone: string, sessionToken?: string): Promise<{ exists: boolean; validPhone?: string }> {
  try {
    const quepasaConfig = await settingsService.getQuepasaConfig();

    if (!quepasaConfig.url || !quepasaConfig.login) {
      throw new Error('Quepasa configuration is missing');
    }

    // Usar APENAS o token da sessão (não usar token global)
    if (!sessionToken) {
      throw new Error('Session token is required for Quepasa authentication');
    }

    console.log(`🔍 Checking if contact exists on Quepasa: ${phone} (usando token da sessão)`);

    // Normalizar número para formato sem caracteres especiais
    const normalizedPhone = phone.replace(/\D/g, '');

    const response = await fetch(`${quepasaConfig.url}/isonwhatsapp`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-QUEPASA-USER': quepasaConfig.login,
        'X-QUEPASA-TOKEN': sessionToken
      },
      body: JSON.stringify([normalizedPhone])
    });

    if (!response.ok) {
      console.error(`❌ Quepasa contact check failed with status ${response.status}`);
      return { exists: false };
    }

    const data: any = await response.json();

    console.log(`📞 Quepasa contact check response:`, data);

    // A resposta da Quepasa retorna um array de números registrados
    // Exemplo: { total: 1, registered: ["5561996878959@s.whatsapp.net"] }
    if (data.registered && Array.isArray(data.registered) && data.registered.length > 0) {
      // Extrair número validado (remover @s.whatsapp.net)
      const validPhone = data.registered[0].replace('@s.whatsapp.net', '');
      console.log(`✅ Contact exists on Quepasa: ${validPhone}`);
      return { exists: true, validPhone };
    }

    console.log(`❌ Contact does not exist on Quepasa: ${phone}`);
    return { exists: false };
  } catch (error) {
    console.error('Error checking contact on Quepasa:', error);
    return { exists: false };
  }
}

/**
 * Configura webhook no QuePasa após a conexão
 */
export async function configureQuepasaWebhook(
  sessionToken: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const quepasaConfig = await settingsService.getQuepasaConfig();

    if (!quepasaConfig.url || !quepasaConfig.login) {
      throw new Error('Quepasa configuration is missing');
    }

    if (!sessionToken) {
      throw new Error('Session token is required for Quepasa authentication');
    }

    console.log(`🔗 Configurando webhook QuePasa: ${webhookUrl}`);

    const response = await fetch(`${quepasaConfig.url}/webhook`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-QUEPASA-TOKEN': sessionToken
      },
      body: JSON.stringify({
        url: webhookUrl,
        forwardinternal: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Quepasa webhook config failed with status ${response.status}: ${errorText}`);
      throw new Error(`Quepasa webhook config error: ${response.status} - ${errorText}`);
    }

    const result: any = await response.json();

    console.log(`✅ Webhook configurado no QuePasa:`, result);

    if (result.success) {
      return { success: true };
    }

    throw new Error(result.status || 'Unknown error from Quepasa');
  } catch (error) {
    console.error('Error configuring Quepasa webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Envia mensagem via Quepasa
 */
export async function sendMessageViaQuepasa(
  sessionName: string,
  phone: string,
  content: any,
  sessionToken?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const quepasaConfig = await settingsService.getQuepasaConfig();

    if (!quepasaConfig.url || !quepasaConfig.login) {
      throw new Error('Quepasa configuration is missing');
    }

    // Usar APENAS o token da sessão (não usar token global)
    if (!sessionToken) {
      throw new Error('Session token is required for Quepasa authentication');
    }

    // Normalizar número para formato sem caracteres especiais
    const normalizedPhone = phone.replace(/\D/g, '');

    console.log(`📤 Sending message via Quepasa to ${normalizedPhone} (usando token da sessão):`, content);

    // Preparar payload baseado no tipo de conteúdo
    const payload: any = {};

    // URL para mídia (imagem, vídeo, áudio, documento)
    // Suporta tanto formato { image: { url } } quanto { url }
    if (content.image?.url) {
      // Força image/jpeg para todas as imagens
      payload.url = content.image.url;
      payload.mime = 'image/jpeg';
      payload.mimetype = 'image/jpeg';
      if (content.caption) {
        payload.text = content.caption;
      }
      console.log(`🖼️ Sending image - URL: ${payload.url}, MIME: ${payload.mime} (forced jpeg), Caption: ${payload.text || 'none'}`);
    } else if (content.video?.url) {
      const mimeType = detectMimeType(content.video.url);
      payload.url = content.video.url;
      payload.mime = mimeType;
      payload.mimetype = mimeType;
      if (content.caption) {
        payload.text = content.caption;
      }
      console.log(`🎥 Sending video - URL: ${payload.url}, MIME: ${payload.mime}, Caption: ${payload.text || 'none'}`);
    } else if (content.audio?.url) {
      const mimeType = detectMimeType(content.audio.url);
      payload.url = content.audio.url;
      payload.mime = mimeType;
      payload.mimetype = mimeType;
      if (content.caption) {
        payload.text = content.caption;
      }
      console.log(`🎵 Sending audio - URL: ${payload.url}, MIME: ${payload.mime}, Caption: ${payload.text || 'none'}`);
    } else if (content.document?.url) {
      const mimeType = detectMimeType(content.document.url);
      payload.url = content.document.url;
      payload.mime = mimeType;
      payload.mimetype = mimeType;
      if (content.caption) {
        payload.text = content.caption;
      }
      console.log(`📄 Sending document - URL: ${payload.url}, MIME: ${payload.mime}, Caption: ${payload.text || 'none'}`);
    } else if (content.url) {
      // Formato direto com URL (fallback)
      const mimeType = detectMimeType(content.url);
      payload.url = content.url;
      payload.mime = mimeType;
      payload.mimetype = mimeType;
      if (content.caption) {
        payload.text = content.caption;
      } else if (content.text) {
        payload.text = content.text;
      }
      console.log(`📎 Sending media (fallback) - URL: ${payload.url}, MIME: ${payload.mime}, Text: ${payload.text || 'none'}`);
    } else if (content.text) {
      // Apenas texto
      payload.text = content.text;
      console.log(`💬 Sending text only: ${payload.text}`);
    }

    console.log(`📦 Quepasa payload (before stringify):`, JSON.stringify(payload, null, 2));

    const response = await fetch(`${quepasaConfig.url}/send`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-QUEPASA-USER': quepasaConfig.login,
        'X-QUEPASA-TOKEN': sessionToken,
        'X-QUEPASA-CHATID': normalizedPhone
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Quepasa request sent to: ${quepasaConfig.url}/send`);
    console.log(`📡 Headers: X-QUEPASA-USER=${quepasaConfig.login}, X-QUEPASA-CHATID=${normalizedPhone}, Token: da sessão`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Quepasa send failed with status ${response.status}: ${errorText}`);
      throw new Error(`Quepasa API error: ${response.status} - ${errorText}`);
    }

    const result: any = await response.json();

    console.log(`✅ Message sent via Quepasa:`, result);

    // Resposta exemplo: { success: true, status: "sended with success", message: { id: "...", wid: "...", chatId: "..." } }
    if (result.success) {
      return {
        success: true,
        id: result.message?.id || 'unknown'
      };
    }

    throw new Error(result.status || 'Unknown error from Quepasa');
  } catch (error) {
    console.error('Error sending message via Quepasa:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
