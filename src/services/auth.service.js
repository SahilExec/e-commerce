const prisma = require('../config/prisma')
const bcrypt = require('bcrypt')

const crypto = require('crypto')

const AppError = require('../utils/AppError')

const jwt = require('jsonwebtoken')

const { redisClient } = require('../config/redis')

const {generateAccessToken, generateRefreshToken} = require('../utils/tokenUtils')
const { id } = require('zod/locales')

const transporter = require('../config/mailer')

const emailQueue = require('../jobs/queue')

const register = async(name, email, password) => {

    const emailLower = email.toLowerCase()
    
    const existingUser = await prisma.user.findUnique({where:{email: emailLower}})

    if(existingUser){
        throw new AppError('Email already registered', 409)
    }

    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const user = await prisma.user.create({
        data:{
            name,
            email: emailLower,
            password: hashedPassword
        }
    })

    try {
        await sendOtp(user.email)
    } catch (err) {
        console.error('OTP email failed after register:', err.message)
    }
   
    const{password: _, ...userWithoutPassword} = user

    return userWithoutPassword
}

const sendOtp = async(email) => {

    const emailLower = email.toLowerCase()

    const user = await prisma.user.findUnique({where:{email: emailLower}})

    if(!user){
        return
    }

    if(user.isVerified){
        throw new AppError('Already verified', 400)
    }

    const otp = crypto.randomInt(100000, 999999).toString()

    const hashedOtp = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex')

    await redisClient.set('otp:' + emailLower, hashedOtp, {EX: 600})

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: emailLower,
        subject: 'Your verification code',
        text: `Your OTP is ${otp}. It expires in 10 minutes.`
    })
}

const verifyOtp = async(email, otp) => {

    const emailLower = email.toLowerCase()

    const storedHash = await redisClient.get('otp:' + emailLower)

    if(!storedHash){
        throw new AppError('OTP expired or not found', 400)
    }

    const hashedOtp = crypto
        .createHash('sha256')
        .update(otp)
        .digest('hex')

    if (hashedOtp !== storedHash) {
        throw new AppError('Invalid OTP', 400)
    }

    const user = await prisma.user.update({
        where: { email: emailLower },
        data: { isVerified: true }
    })

    await redisClient.del('otp:' + emailLower)

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
}

const login = async(email, password) => {
    
    const user = await prisma.user.findUnique({where: {email: email.toLowerCase()}})

    if(!user){
        throw new AppError('Invalid credentials', 401)
    }

    const isMatch = await bcrypt.compare(password, user.password)
    
    if(!isMatch){
        throw new AppError('Invalid credentials', 401)
    }

    if (!user.isVerified) {
        throw new AppError('Please verify your email', 403)
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    const hashedToken = crypto
    .createHash('sha256')
    .update(newRefreshToken)
    .digest('hex')
    

    // expiresAt = 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const refreshToken = await prisma.refreshToken.create({
        data:{
            token : hashedToken, // hsahed version
            userId : user.id,
            expiresAt: expiresAt
        }
    })

    return {accessToken, refreshToken: newRefreshToken}
}

const getMe = async (userId) => {
    const user = await prisma.user.findUnique({
        where: {id: userId},
        select: {
            id:true,
            name: true,
            email: true,
            role: true,
            isVerified: true,
            createdAt: true
        }
    })

    if(!user) throw new AppError('User not found', 404)

    return user
}


const refreshAccessToken = async (rawToken) => {
    
    const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex')

    const tokenRecord = await prisma.refreshToken.findUnique({ where: {token: hashedToken}})

    if(!tokenRecord){
        throw new AppError('Invalid refrsh token', 401)
    }

    if(tokenRecord.expiresAt < new Date()){
        throw new AppError('Refresh token expired', 401)
    }

    // need the user's role - fetch user from DB or include in findUnique
    const user = await prisma.user.findUnique({where: {id: tokenRecord.userId}})
    
    const accessToken = generateAccessToken(user.id, user.role);
    
    await prisma.refreshToken.delete({where: {id : tokenRecord.id}})

    const newRefreshToken = generateRefreshToken(user.id);

    const hashedRefresh = crypto
    .createHash('sha256')
    .update(newRefreshToken)
    .digest('hex')

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const refreshToken = await prisma.refreshToken.create({
        data: {
            token : hashedRefresh,
            userId : user.id,
            expiresAt : expiresAt
        }
    })

    return {accessToken, refreshToken: newRefreshToken}
}

const logout = async (rawToken, accessToken) => {
    
    const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex')

    const tokenRecord = await prisma.refreshToken.findUnique({where: {token: hashedToken}})

    if(!tokenRecord){
        throw new AppError('Invalid token', 401)
    }

    await prisma.refreshToken.delete({where: {id: tokenRecord.id}})

    // Blacklisting Access Token
    const hashedAccess = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex')

    const decoded = jwt.decode(accessToken)
    const ttl = decoded.exp - Math.floor(Date.now() / 1000)

    if (ttl > 0) {
        await redisClient.set('bl:' + hashedAccess, '1', { EX: ttl })
    }
}

const forgotPassword = async (email) => {
    const emailLower = email.toLowerCase()

    const user = await prisma.user.findUnique({ where: { email: emailLower } })

    if (!user) {
        return
    }

    const token = crypto.randomBytes(32).toString('hex')

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

    await redisClient.set('reset:' + hashedToken, emailLower, { EX: 900 })

    await emailQueue.add('password-reset', { email: emailLower, token })
}

const resetPassword = async (token, password) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

    const emailLower = await redisClient.get('reset:' + hashedToken)

    if (!emailLower) {
        throw new AppError('Reset token expired or not found', 400)
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.update({
        where: { email: emailLower },
        data: { password: hashedPassword }
    })

    await redisClient.del('reset:' + hashedToken)

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } })
}

module.exports = {register, login, getMe, refreshAccessToken, logout, sendOtp, verifyOtp, forgotPassword, resetPassword}