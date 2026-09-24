const asyncHandler = require('../utils/asyncHandler')

const orderService = require('../services/order.service')

const checkout = asyncHandler(async (req, res) => {
    const { userId } = req.user
    const { addressId } = req.body
    const order = await orderService.checkout(userId, addressId)
 
    res.status(201).json({
        success: true,
        data: order
    })
})

const getOrders = asyncHandler(async (req, res) => {
    const { userId } = req.user
    const orders = await orderService.getOrders(userId)

    res.status(200).json({
        success: true,
        data: orders
    })
})

const getOrder = asyncHandler(async (req, res) => {
    const { userId } = req.user
    const orderId = req.params.id
    const order = await orderService.getOrder(userId, orderId)

    res.status(200).json({
        success: true,
        data: order
    })
})

const cancelOrder = asyncHandler(async (req, res) => {
    const { userId } = req.user
    const orderId = req.params.id
    const result = await orderService.cancelOrder(userId, orderId)

    res.status(200).json({ 
        success: true, 
        ...result })
})

module.exports = { checkout, getOrders, getOrder, cancelOrder }