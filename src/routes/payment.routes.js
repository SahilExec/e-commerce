const express = require('express')

const router = express.Router()

const paymentController = require('../controllers/payment.controller')

router.post('/verify', paymentController.verifyPayment)

router.post('/webhook', paymentController.razorpayWebhook)

module.exports = router