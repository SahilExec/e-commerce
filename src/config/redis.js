const { createClient } = require('redis')
const logger = require('./logger')

const redisClient = createClient({
    url: process.env.REDIS_URL,
    pingInterval: 30000,
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
    }
})

redisClient.on('error', (err) => {
    logger.error('Redis error', { message: err.message })
})

const connectRedis = async () => {
    await redisClient.connect()
    console.log('Redis connected')
}

module.exports = { redisClient, connectRedis }