const { createClient } = require('redis')

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
})

const connectRedis = async () => {
    await redisClient.connect()
    console.log('Redis connected')
}

module.exports = { redisClient, connectRedis }