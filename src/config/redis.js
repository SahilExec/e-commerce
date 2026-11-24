const { createClient } = require('redis')

const redisClient = createClient({
    url: process.env.REDIS_URL
})

const connectRedis = async () => {
    await redisClient.connect()
    console.log('Redis connected')
}

module.exports = { redisClient, connectRedis }