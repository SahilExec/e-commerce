const {z} = require('zod')

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters')
})

const loginSchema = z.object({
    email: z.string().trim().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters')
})

const sendOtpSchema = z.object({
    email: z.string().trim().email('Invalid email format')
})

const verifyOtpSchema = z.object({
    email: z.string().trim().email('Invalid email format'),
    otp: z.coerce.string().regex(/^\d{6}$/, 'OTP must be 6 digits')
})

const forgotPasswordSchema = z.object({
    email: z.string().trim().email('Invalid email format')
})

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters')
})

module.exports = { registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema }