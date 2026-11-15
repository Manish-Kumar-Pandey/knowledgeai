export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'KnowledgeAI - Enterprise Knowledge Base AI Assistant API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API for multi-tenant document ingestion, hybrid vector/full-text search, and low-hallucination RAG streaming conversational interface.',
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register new user and create enterprise organization workspace',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  fullName: { type: 'string' },
                  organizationName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration successful' },
          409: { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user and return JWT access/refresh tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authentication successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/knowledge-bases': {
      get: {
        summary: 'List knowledge bases for active organization',
        responses: { 200: { description: 'List of knowledge bases' } },
      },
      post: {
        summary: 'Create a new knowledge base',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Knowledge base created' } },
      },
    },
    '/documents/upload': {
      post: {
        summary: 'Upload document (PDF, DOCX, TXT, MD) and enqueue for background ingestion',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'knowledgeBaseId'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                  knowledgeBaseId: { type: 'string', format: 'uuid' },
                  title: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Uploaded and enqueued for ingestion' } },
      },
    },
    '/documents': {
      get: {
        summary: 'List indexed documents with chunk counts and filtering',
        parameters: [
          { name: 'kbId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'List of documents' } },
      },
    },
    '/chat/conversations': {
      get: {
        summary: 'List conversations for active user',
        responses: { 200: { description: 'List of conversations' } },
      },
      post: {
        summary: 'Create new conversational workspace session',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  selectedKbIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Conversation session created' } },
      },
    },
    '/chat/conversations/{id}/messages/stream': {
      post: {
        summary: 'Ask query and stream low-hallucination RAG response via Server-Sent Events (SSE)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['question'],
                properties: {
                  question: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'SSE event stream with citations and token deltas',
            content: { 'text/event-stream': {} },
          },
        },
      },
    },
    '/analytics/overview': {
      get: {
        summary: 'Retrieve real-time metrics, latencies, feedback, and document counts',
        responses: { 200: { description: 'Analytics overview data' } },
      },
    },
    '/evaluations/runs': {
      get: {
        summary: 'List historical RAG benchmark evaluation experiments',
        responses: { 200: { description: 'Evaluation history' } },
      },
    },
    '/evaluations/run': {
      post: {
        summary: 'Trigger automated RAG benchmark evaluation run',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['datasetId'],
                properties: { datasetId: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Evaluation results calculated' } },
      },
    },
  },
};
