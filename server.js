require('dotenv').config()
require('./src/config/env')

const connectMongoDB = require('./src/config/mongoose')

const {connectRedis} = require('./src/config/redis')

const PORT = process.env.PORT || 3000

Promise.all([
    connectMongoDB(),
    connectRedis()
]).then(() => {
    const app = require('./src/app')
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
        if (process.env.RUN_WORKER_IN_PROCESS === 'true') {
            require('./src/jobs/worker')()
        }
    })
}).catch((err) => {
    console.error('Connection failed:', err.message)
    process.exit(1)
})
