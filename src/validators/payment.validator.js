const { z } = require('zod')

const verifyPaymentSchema = z.object({
    razorpay_order_id: z.string().min(1, 'Order ID is required'),
    razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
    razorpay_signature: z.string().min(1, 'Signature is required')
})

module.exports = { verifyPaymentSchema }