import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Cross With Friends API',
      version: require('../package.json').version,
      description: 'API for Cross With Friends — a collaborative crossword puzzle platform.',
    },
    servers: [{url: '/api', description: 'API base path'}],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from /auth/login or /auth/signup',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {type: 'string'},
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: {type: 'string'},
            email: {type: 'string'},
            displayName: {type: 'string'},
            emailVerified: {type: 'boolean'},
            authProvider: {type: 'string'},
            hasPassword: {type: 'boolean'},
            hasGoogle: {type: 'boolean'},
            profileIsPublic: {type: 'boolean'},
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: {type: 'string'},
            user: {$ref: '#/components/schemas/UserProfile'},
          },
        },
      },
    },
  },
  apis: ['./server/api/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
