const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export class ApiClient {
  private static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('knowledgeai_token');
  }

  private static getOrganizationId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('knowledgeai_active_org_id');
  }

  static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken();
    const orgId = this.getOrganizationId();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (orgId) {
      headers['x-organization-id'] = orgId;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      if (typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('knowledgeai_token');
        localStorage.removeItem('knowledgeai_refresh_token');
        window.location.href = '/login';
      }
    }

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || `Request failed with status ${response.status}`);
    }

    return json.data as T;
  }

  static get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static post<T = any>(endpoint: string, body?: any) {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  static put<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  static patch<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  static delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Connects to Server-Sent Events (SSE) streaming endpoint for chat responses
   */
  static async streamChat(
    conversationId: string,
    question: string,
    callbacks: {
      onRewrittenQuery?: (data: { original: string; rewritten: string }) => void;
      onMetadata?: (data: { retrievalDurationMs: number; citations: any[] }) => void;
      onToken?: (token: string) => void;
      onDone?: (data: any) => void;
      onError?: (err: Error) => void;
      onRenamed?: (data: { id: string; title: string }) => void;
    }
  ): Promise<void> {
    const token = this.getAccessToken();
    const orgId = this.getOrganizationId();

    const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
        'x-organization-id': orgId || '',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const block of lines) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let eventData = '';

        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        try {
          const parsed = JSON.parse(eventData);
          if (eventType === 'rewritten_query' && callbacks.onRewrittenQuery) {
            callbacks.onRewrittenQuery(parsed);
          } else if (eventType === 'metadata' && callbacks.onMetadata) {
            callbacks.onMetadata(parsed);
          } else if (eventType === 'token' && callbacks.onToken) {
            callbacks.onToken(parsed.token);
          } else if (eventType === 'conversation_renamed' && callbacks.onRenamed) {
            callbacks.onRenamed(parsed);
          } else if (eventType === 'done' && callbacks.onDone) {
            callbacks.onDone(parsed);
          } else if (eventType === 'error' && callbacks.onError) {
            callbacks.onError(new Error(parsed.error));
          }
        } catch {
          // Ignore parse errors on ping/comments
        }
      }
    }
  }
}
