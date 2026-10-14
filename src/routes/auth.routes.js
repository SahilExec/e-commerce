const express = require('express');
const router = express.Router()

const authController = require('../controllers/auth.controller')

const validate = require('../middlewares/validate')
const {registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema, forgotPasswordSchema} = require('../validators/auth.validator')

const {protect} = require('../middlewares/auth.middleware')

const {
    loginIpLimiter,
    loginEmailLimiter,
    otpIpLimiter,
    otpEmailLimiter,
    verifyIpLimiter,
    verifyEmailLimiter,
    forgotIpLimiter,
    forgotEmailLimiter,
    resetIpLimiter
} = require('../middlewares/rateLimit')

router.post('/register', validate(registerSchema), authController.register)

router.post('/send-otp', validate(sendOtpSchema), otpIpLimiter, otpEmailLimiter, authController.sendOtp)

router.post('/verify-otp', validate(verifyOtpSchema), verifyIpLimiter, verifyEmailLimiter, authController.verifyOtp)

router.post('/login', validate(loginSchema), loginIpLimiter, loginEmailLimiter, authController.login);

router.get('/me', protect, authController.me)

router.post('/refresh-token', authController.refresh)

router.post('/logout', protect, authController.logout)

router.post('/forgot-password', validate(forgotPasswordSchema), forgotIpLimiter, forgotEmailLimiter, authController.forgotPassword)

router.post('/reset-password', resetIpLimiter, authController.resetPassword)

module.exports = router