const {z} = require('zod')

const createProductSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    price: z.coerce.number().positive(),
    quantity: z.coerce.number().int().min(0),
    category: z.string().length(24, 'Invalid category ID'),
    attributes: z.array(z.object({
        key: z.string(),
        value: z.any()
    })).optional()
})

const updateProductSchema = createProductSchema.partial()

module.exports = { createProductSchema, updateProductSchema }