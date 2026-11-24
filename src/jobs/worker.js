const logger = require('../config/logger')

const emailQueue = require('./queue')

const { processOrderConfirmation, processPasswordReset } = require('./email.processor')


function startEmailWorker() {
    emailQueue.process('order-confirmation', processOrderConfirmation)
    emailQueue.process('password-reset', processPasswordReset)

    logger.info('Email worker starting')

    emailQueue.on('completed', (job) => {
        logger.info('Job completed', {
            id: job && job.id,
            name: job && job.name,
            orderId: job && job.data && job.data.orderId,
            email: job && job.data && job.data.email
        })
    })

    emailQueue.on('failed', (job, err) => {
        logger.error('Job failed', {
            id: job && job.id,
            name: job && job.name,
            attemptsMade: job && job.attemptsMade,
            orderId: job && job.data && job.data.orderId,
            email: job && job.data && job.data.email,
            error: err.message
        })
    })

    emailQueue.on('error', (err) => {
        logger.error('Queue error', { message: err.message })
    })

}

module.exports = startEmailWorker

if (require.main === module) {
    require('dotenv').config()
    require('../config/env')
    startEmailWorker()
}