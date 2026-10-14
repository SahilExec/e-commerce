const prisma = require('../config/prisma')
const transporter = require('../config/mailer')

const processOrderConfirmation = async (job) => {
    const { orderId } = job.data

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true, items: true }
    })

    if (!order || order.status !== 'PAID') {
        return
    }

    const lines = order.items
        .map((item) => `${item.name} x ${item.quantity}`)
        .join('\n')

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: order.user.email,
        subject: `Order confirmed — ${order.id}`,
        text: `Hi ${order.fullName},\n\nYour order is paid.\nTotal: ${order.total}\n\n${lines}\n`
    })
}

const processPasswordReset = async (job) => {
    const { email, token } = job.data

    const resetUrl =
        process.env.BASE_URL + '/auth/reset-password?token=' + token

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Reset your password',
        text: `Reset your password (expires in 15 minutes):\n\n${resetUrl}\n`,
        html: `<p>Click the link below to reset your password. It expires in 15 minutes.</p>
                <p><a href="${resetUrl}">Reset password</a></p>
                <p>If the link does not open, copy this URL:</p>
                <p>${resetUrl}</p>`
    })
}

module.exports = { processOrderConfirmation, processPasswordReset }