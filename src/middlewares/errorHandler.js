const logger = require('../config/logger')

const errorHandler = (err, req, res, next) => {

    const statusCode = err.statusCode || 500

    logger.error({
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        statusCode
    })

    if (process.env.NODE_ENV == 'development') {
        return res.status(statusCode).json({
            success: false,
            message: err.message,
            stack: err.stack // exact line where error occurred
        })
    }

    res.status(statusCode).json({
        sucess: false,
        message: err.isOperational ? err.message : 'Something went wrong'
    })
}

module.exports = errorHandler