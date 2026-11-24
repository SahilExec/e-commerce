const Queue = require('bull')

const emailQueue = new Queue('email', process.env.REDIS_URL, {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    }
})

module.exports = emailQueue