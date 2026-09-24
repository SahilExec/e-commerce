const prisma = require('../config/prisma')

const Product = require('../models/product.model')

const AppError = require('../utils/AppError')

const { redisClient } = require('../config/redis')

const { clearCart } = require('./cart.service')

const { invalidateCache } = require('../utils/cache')

const razorpayInstance = require('../config/razorpay')

const paymentService = require('./payment.service')

const { restoreStock } = require('../utils/stock')

const checkout = async (userId, addressId) => {
    const address = await prisma.address.findUnique({
        where: { id: addressId }
    })

    if (!address) {
        throw new AppError('Address not found', 404)
    }

    if (address.userId !== userId) {
        throw new AppError('Forbidden', 403)
    }

    const fields = await redisClient.hGetAll('cart:' + userId)

    if (Object.keys(fields).length === 0) {
        throw new AppError('Cart is empty', 400)
    }

    const taken = []
    const items = []
    let total = 0

    try {
        for (const [productId, rawQty] of Object.entries(fields)) {
            const quantity = Number(rawQty)

            const product = await Product.findOneAndUpdate(
                {
                    _id: productId,
                    isActive: true,
                    quantity: { $gte: quantity }
                },
                { $inc: { quantity: -quantity } },
                { new: true }
            )

            if (!product) {
                throw new AppError('Not enough stock', 400)
            }

            taken.push({ productId, quantity })

            const price = Number(product.price)
            const lineTotal = price * quantity

            items.push({
                productId,
                name: product.name,
                price,
                quantity,
                lineTotal
            })

            total += lineTotal
        }

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: Math.round(Number(total) * 100),
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`,
        })

        const order = await prisma.order.create({
            data: {
                userId,
                total,
                fullName: address.fullName,
                phone: address.phone,
                line1: address.line1,
                line2: address.line2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                items: { create: items },
                payment: {
                    create: {
                        amount: total,
                        status: 'PENDING',
                        razorpayOrderId: razorpayOrder.id
                    }
                }
            },
            include: { items: true, payment: true }
        })

        await clearCart(userId)

        await invalidateCache('cache:/products')

        return order

    } catch (err) {
        await restoreStock(taken)
        throw err
    }
}

const getOrders = async (userId) => {
    return prisma.order.findMany({
        where: { userId },
        include: { items: true, payment: true },
        orderBy: { createdAt: 'desc' }
    })
}

const getOrder = async (userId, orderId) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true }
    })

    if (!order) {
        throw new AppError('Order not found', 404)
    }

    if (order.userId !== userId) {
        throw new AppError('Forbidden', 403)
    }

    return order
}

const cancelOrder = async (userId, orderId) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true }
    })

    if (!order) {
        throw new AppError('Order not found', 404)
    }

    if (order.userId !== userId) {
        throw new AppError('Forbidden', 403)
    }

    if (order.status === 'PENDING') {
        const result = await prisma.order.updateMany({
            where: { id: orderId, status: 'PENDING' },
            data: { status: 'CANCELLED' }
        })

        if (result.count === 0) {
            throw new AppError('Order cannot be cancelled - already processed', 400)
        }

        await restoreStock(order.items)
        await invalidateCache('cache:/products')

        return { message: 'Order cancelled' }
    }

    if (order.status === 'PAID') {
        const payment = await paymentService.initiateRefund(order)

        return { message: 'Refund initiated, this may take a few days', payment }
    }

    throw new AppError(`Order cannot be cancelled - current status: ${order.status}`, 400)
}

module.exports = { checkout, getOrders, getOrder, cancelOrder  }