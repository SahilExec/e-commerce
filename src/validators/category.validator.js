const { z } = require('zod')

const objectId = z.string().length(24, 'Invalid category ID')

const createCategorySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    parent: objectId.nullable().optional()
})

const updateCategorySchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    description: z.string().optional(),
    parent: objectId.nullable().optional()
})

module.exports = { createCategorySchema, updateCategorySchema }