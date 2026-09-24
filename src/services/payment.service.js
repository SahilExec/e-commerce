const crypto = require('crypto')

const prisma = require('../config/prisma')

const AppError = require('../utils/AppError')

const razorpayInstance = require('../config/razorpay')

const { restoreStock } = require('../utils/stock')

const { invalidateCache } = require('../utils/cache')

const verifyPaymentSignature = (orderId, paymentId, signature) => {
    const body = orderId + '|' + paymentId

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex')

    if (signature !== expectedSignature) {
        throw new AppError('Invalid signature', 400)
    }
}

const verifyWebhookSignature = (rawBody, signature) => {
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')

    if (signature !== expectedSignature) {
        throw new AppError('Invalid webhook signature', 400)
    }
}

// shared, idempotent - called by BOTH the frontend verify flow AND the webhook
const capturePayment = async (razorpayOrderId, razorpayPaymentId) => {
    const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId }
    })

    if (!payment) {
        throw new AppError('Payment not found', 404)
    }

    if (payment.status !== 'PENDING') {
        return payment
    }

    const [updatedPayment] = await prisma.$transaction([
        prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'CAPTURED',
                razorpayPaymentId
            }
        }),
        prisma.order.update({
            where: { id: payment.orderId },
            data: { status: 'PAID' }
        })
    ])

    return updatedPayment
}

const verifyPayment = async (body) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)

    return capturePayment(razorpay_order_id, razorpay_payment_id)
}

const initiateRefund = async (order) => {
    if (!order.payment || !order.payment.razorpayPaymentId) {
        throw new AppError('No captured payment found for this order', 400)
    }

    const claim = await prisma.payment.updateMany({
        where: { orderId: order.id, status: 'CAPTURED' },
        data: { status: 'REFUND_INITIATED' }
    })

    if (claim.count === 0) {
        throw new AppError('Refund already initiated for this order', 400)
    }

    try {
        await razorpayInstance.payments.refund(order.payment.razorpayPaymentId)
    } catch (err) {
        
        await prisma.payment.update({
            where: { orderId: order.id },
            data: { status: 'CAPTURED' }
        })
        
        throw err
    }

    return prisma.payment.findUnique({ where: { orderId: order.id } })
}

const finishRefund = async (orderId) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true }
    })

    if (!order || order.status === 'CANCELLED') {
        return
    }

    await restoreStock(order.items)

    await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' }
    })

    await invalidateCache('cache:/products')
}

const handleRefundProcessed = async (razorpayPaymentId) => {
    const payment = await prisma.payment.findFirst({
        where: { razorpayPaymentId }
    })

    if (!payment) {
        return { received: true }
    }

    await prisma.payment.updateMany({
        where: { orderId: payment.orderId, status: 'REFUND_INITIATED' },
        data: { status: 'REFUNDED' }
    })

    await finishRefund(payment.orderId)
    return { received: true }
}

const handleWebhook = async (rawBody, signature, payload) => {
    verifyWebhookSignature(rawBody, signature)

    if (payload.event === 'payment.captured') {
        const paymentEntity = payload.payload.payment.entity

        return capturePayment(paymentEntity.order_id, paymentEntity.id)
    }

    if (payload.event === 'refund.processed') {
        const refundEntity = payload.payload.refund.entity

        return handleRefundProcessed(refundEntity.payment_id)
    }

    return { received: true }
}

module.exports = { verifyPayment, handleWebhook, initiateRefund }