const asyncHandler = require('../utils/asyncHandler') 
// No try/catch anywhere - asyncHandler wraps every controller function - automatically forwards any error to next()

const AppError = require('../utils/AppError')

const authService = require('../services/auth.service');
const { success } = require('zod');

const { resetPasswordSchema } = require('../validators/auth.validator')

const register = asyncHandler(async (req, res) => {
    const {name, email, password} = req.body;
    const result = await authService.register(name, email, password);
    res.status(201).json({
        success: true, 
        data: result
    });
})

const sendOtp = asyncHandler( async(req, res) => {
    const {email} = req.body;

    await authService.sendOtp(email)

    res.status(200).json({
        success: true
    })
})

const verifyOtp = asyncHandler( async(req, res) => {
    const {email, otp} = req.body;

    const user = await authService.verifyOtp(email, otp)

    res.status(200).json({
        success: true,
        data: user
    })
})

const login = asyncHandler(async (req, res) => {
    const {email, password} = req.body;
    const result = await authService.login(email, password);
    
    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,  // Js can't access this
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',  // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    
    res.status(200).json({
        success: true, 
        data: {accessToken : result.accessToken}
    });
})

const me = asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user.userId)
    res.status(200).json({
        success: true,
        data: user
    })
})

const refresh = asyncHandler(async (req, res) => {
    
    const rawToken = req.cookies.refreshToken

    if (!rawToken) {
        throw new AppError('No refresh token provided', 401)
    }

    const result = await authService.refreshAccessToken(rawToken)

    res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.status(200).json({
        success: true,
        data: {accessToken : result.accessToken}
    })
})

const logout = asyncHandler(async (req, res) => {

    const accessToken = req.headers.authorization.split(' ')[1]
    
    const rawToken = req.cookies.refreshToken

    if(!rawToken){
        throw new AppError('No refresh token provided', 401)
    }

    await authService.logout(rawToken, accessToken)

    res.clearCookie('refreshToken')

    res.status(200).json({
        success: true
    })
})

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body

    await authService.forgotPassword(email)

    res.status(200).json({
        success: true,
        message: 'If that email exists, we sent a reset token'
    })
})

const resetPassword = asyncHandler(async (req, res) => {
    const result = resetPasswordSchema.safeParse({
        token: req.body.token || req.query.token,
        password: req.body.password
    })

    if (!result.success) {
        throw new AppError(result.error.issues[0].message, 400)
    }

    await authService.resetPassword(result.data.token, result.data.password)

    res.status(200).json({ success: true })
})

module.exports = { register, login, me, refresh, logout, sendOtp, verifyOtp, forgotPassword, resetPassword }