const {z} = require('zod')

const createAddressSchema = z.object({
    fullName:z.string().trim().min(2, 'Name must be at least 2 characters'),
    phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    line1: z.string().trim().min(3, 'Address line is required'),
    line2: z.string().trim().optional(),
    city: z.string().trim().min(2, 'City is required'),
    state: z.string().trim().min(2, 'State is required'),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    isDefault: z.boolean().optional()
})

const updateAddressSchema = createAddressSchema.partial()

module.exports = { createAddressSchema, updateAddressSchema }