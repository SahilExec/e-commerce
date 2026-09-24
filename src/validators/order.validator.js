const {z} = require('zod')

const checkoutSchema = z.object({
    addressId: z.string().uuid('Invalid address ID')
})

module.exports = { checkoutSchema }