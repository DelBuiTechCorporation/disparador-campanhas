import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Endpoint proxy para fazer requisições HTTP REST
 * Evita problemas de CORS no frontend
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { url, method, headers, body, timeout } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    console.log(`🔗 HTTP Proxy - ${method || 'GET'} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (timeout || 30) * 1000);

    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers: headers || {},
      signal: controller.signal,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method?.toUpperCase() || '')) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    });

  } catch (error: any) {
    console.error('❌ HTTP Proxy error:', error.message);

    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Timeout: A requisição demorou mais que o esperado' });
    }

    res.status(500).json({
      error: error.message || 'Erro ao fazer requisição HTTP',
    });
  }
});

export default router;
