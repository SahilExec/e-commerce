const express = require('express')

const router = express.Router()

const paymentController = require('../controllers/payment.controller')

const validate = require('../middlewares/validate')

const { verifyPaymentSchema } = require('../validators/payment.validator')

router.post('/verify', validate(verifyPaymentSchema), paymentController.verifyPayment)

router.post('/webhook', paymentController.razorpayWebhook)

module.exports = router