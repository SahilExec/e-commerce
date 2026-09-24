const asyncHandler = require('../utils/asyncHandler')

const paymentService = require('../services/payment.service')

const verifyPayment = asyncHandler(async (req, res) => {
    const payment = await paymentService.verifyPayment(req.body)

    res.status(200).json({ 
        success: true, 
        data: payment 
    })
})

const razorpayWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature']
    await paymentService.handleWebhook(req.rawBody, signature, req.body)

    res.status(200).json({ 
        success: true 
    })
})

module.exports = { verifyPayment, razorpayWebhook }