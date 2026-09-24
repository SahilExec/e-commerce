const express = require('express')
const router = express.Router()
 
const { protect } = require('../middlewares/auth.middleware')

const validate = require('../middlewares/validate')

const { checkoutSchema } = require('../validators/order.validator')

const orderController = require('../controllers/order.controller')
 
router.post('/checkout', protect, validate(checkoutSchema), orderController.checkout)

router.get('/', protect, orderController.getOrders)
 
router.get('/:id', protect, orderController.getOrder)

router.post('/:id/cancel', protect, orderController.cancelOrder)

module.exports = router