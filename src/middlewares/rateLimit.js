const {rateLimit} = require('express-rate-limit')
const {RedisStore} = require('rate-limit-redis')
const {redisClient} = require('../config/redis')

const AppError = require('../utils/AppError')

const store = (prefix) => new RedisStore({
    prefix,
    sendCommand: (...args) => redisClient.sendCommand(args)
})

const tooMany = (req, res, next) => {
    next(new AppError('Too many requests', 429))
}

const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    store: store('rl:login:ip:'),
    handler: tooMany
})

const loginEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    store: store('rl:login:email:'),
    keyGenerator: (req) => (req.body.email || '').toLowerCase(),
    skip: (req) => !req.body?.email,
    handler: tooMany
})

const otpIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    store: store('rl:otp:ip:'),
    handler: tooMany
})

const otpEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    store: store('rl:otp:email:'),
    keyGenerator: (req) => (req.body.email || '').toLowerCase(),
    skip: (req) => !req.body?.email,
    handler: tooMany
})

const verifyIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    store: store('rl:verify:ip:'),
    handler: tooMany
})

const verifyEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    store: store('rl:verify:email:'),
    keyGenerator: (req) => (req.body.email || '').toLowerCase(),
    skip: (req) => !req.body?.email,
    handler: tooMany
})

const forgotIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    store: store('rl:forgot:ip:'),
    handler: tooMany
})

const forgotEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    store: store('rl:forgot:email:'),
    keyGenerator: (req) => (req.body.email || '').toLowerCase(),
    skip: (req) => !req.body?.email,
    handler: tooMany
})

const resetIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    store: store('rl:reset:ip:'),
    handler: tooMany
})

const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    store: store('rl:public:ip:'),
    handler: tooMany
})

const cartLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    store: store('rl:cart:user:'),
    keyGenerator: (req) => req.user.userId,
    handler: tooMany
})

module.exports = {
    loginIpLimiter,
    loginEmailLimiter,
    otpIpLimiter,
    otpEmailLimiter,
    verifyIpLimiter,
    verifyEmailLimiter,
    forgotIpLimiter,
    forgotEmailLimiter,
    resetIpLimiter,
    publicLimiter,
    cartLimiter
}