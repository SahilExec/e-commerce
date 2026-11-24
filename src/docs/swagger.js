const path = require('path')
const swaggerJsdoc = require('swagger-jsdoc')

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'E-Commerce Backend API',
            version: '1.0.0',
            description:
                'REST API for catalog, cart, checkout, and Razorpay payments. ' +
                'Access token is a Bearer JWT from POST /auth/login. ' +
                'Refresh token is an httpOnly cookie (refreshToken) used only by POST /auth/refresh-token and POST /auth/logout.'
        },
        servers: [
            {
                url: '/',
                description: 'This host (local or deployed)'
            }
        ],
        tags: [
            { name: 'Health' },
            { name: 'Auth' },
            { name: 'Products' },
            { name: 'Categories' },
            { name: 'Cart' },
            { name: 'Addresses' },
            { name: 'Orders' },
            { name: 'Payments' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description:
                        'Access token from POST /auth/login. Header: Authorization: Bearer <token>'
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'refreshToken',
                    description:
                        'httpOnly cookie set by login and refresh. Used by POST /auth/refresh-token and POST /auth/logout. Swagger Try it out on the same host sends it automatically after login.'
                }
            }
        }
    },
    apis: [path.join(__dirname, 'paths.yaml')]
})

module.exports = swaggerSpec
