require('dotenv').config()

const emailQueue = require('./queue')
const { processOrderConfirmation, processPasswordReset } = require('./email.processor')

emailQueue.process('order-confirmation', processOrderConfirmation)
emailQueue.process('password-reset', processPasswordReset)

console.log('Email worker starting')

emailQueue.on('completed', (job) => {
    console.log('Job completed', {
        id: job && job.id,
        name: job && job.name,
        orderId: job && job.data && job.data.orderId,
        email: job && job.data && job.data.email
    })
})

emailQueue.on('failed', (job, err) => {
    console.error('Job failed', {
        id: job && job.id,
        name: job && job.name,
        attemptsMade: job && job.attemptsMade,
        orderId: job && job.data && job.data.orderId,
        email: job && job.data && job.data.email,
        error: err.message
    })
})

emailQueue.on('error', (err) => {
    console.error('Queue error', err.message)
})