const required = [
    'DATABASE_URL',
    'MONGODB_URI',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'EMAIL_USER',
    'EMAIL_PASS',
    'BASE_URL',
    'CORS_ORIGINS',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET'
]

const missing = required.filter((key) => {
    const value = process.env[key]
    return !value || !String(value).trim()
})

if (missing.length > 0) {
    console.error('Missing environment variables: ' + missing.join(', '))
    process.exit(1)
}

module.exports = process.env