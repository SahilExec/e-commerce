const express = require('express')

const path = require('path')

const cookieParser = require('cookie-parser')

const helmet = require('helmet')

const cors = require('cors')

const authRoutes = require('./routes/auth.routes');

const productRoutes = require('./routes/product.routes')

const categoryRoutes = require('./routes/category.routes')

const cartRoutes = require('./routes/cart.routes')

const addressRoutes = require('./routes/address.routes')

const orderRoutes = require('./routes/order.routes')

const paymentRoutes = require('./routes/payment.routes')

const errorHandler = require('./middlewares/errorHandler');

const morgan = require('morgan')
const logger = require('./config/logger')

const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./docs/swagger')

const app = express();

app.set('trust proxy', 1)

const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

app.use(helmet())

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) {
            return cb(null, true)
        }
        if (allowedOrigins.includes(origin)) {
            return cb(null, true)
        }
        return cb(null, false)
    },
    credentials: true
}))

app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    {
        skip: (req) => req.path === '/health',
        stream: { write: (msg) => logger.http(msg.trim()) }
    }
))

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf   // buf = the original raw Buffer of bytes, untouched
    }
}))

app.use(cookieParser())

app.get('/health' , (req, res) => {
    res.json({status: 'ok', message: 'Server is running'})
})

app.use(
    '/api-docs',
    (req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
        )
        next()
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'E-Commerce API Docs',
        customfavIcon: '/favicon.svg',
        customCss: 'html { color-scheme: light; } body { background: #fafafa; }',
        customJsStr:
            '(function () {' +
            'var original = window.matchMedia.bind(window);' +
            'window.matchMedia = function (query) {' +
            'if (!/prefers-color-scheme:\\s*dark/i.test(String(query))) {' +
            'return original(query);' +
            '}' +
            'return {' +
            'matches: false,' +
            'media: query,' +
            'onchange: null,' +
            'addListener: function () {},' +
            'removeListener: function () {},' +
            'addEventListener: function () {},' +
            'removeEventListener: function () {},' +
            'dispatchEvent: function () { return false; }' +
            '};' +
            '};' +
            '})();',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            withCredentials: true
        }
    })
)

app.use(express.static(path.join(__dirname, '../public')))

app.use('/docs', express.static(path.join(__dirname, '../docs')))

app.use('/auth', authRoutes)
app.use('/products', productRoutes)
app.use('/categories', categoryRoutes)
app.use('/cart', cartRoutes)
app.use('/addresses', addressRoutes)
app.use('/orders', orderRoutes)
app.use('/payments', paymentRoutes)

app.use(errorHandler) // after all routes

module.exports = app