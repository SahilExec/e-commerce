const Product = require('../models/product.model')
const AppError = require('../utils/AppError')

const slugify = require('../utils/slugify')

const cloudinary = require('../config/cloudinary')

const Category = require('../models/category.model')

const mongoose = require('mongoose')

const { invalidateCache } = require('../utils/cache')

const buildCategoryChain = async (categoryId) => {
    const chain = []
    let current = await Category.findById(categoryId)

    while (current) {

        chain.push(current._id)

        if (!current.parent) {
            break;
        } else {
            current = await Category.findById(current.parent)
        }

    }

    return chain
}

const createProduct = async (productData) => {

    // generate slug for product
    productData.slug = slugify(productData.name)

    // build category path
    const categoryPath = await buildCategoryChain(productData.category)

    const { name, description, price, quantity, images, category, slug, attributes } = productData

    const product = await Product.create({
        name,
        description,
        price,
        quantity,
        images,
        category,
        categoryPath,
        slug,
        attributes
    })

    await invalidateCache('cache:/products')

    return product
}

// With offset pagination 
// const getProducts = async (filters) => {

//     const { category, search, attributeKey, attributeValue, minPrice, maxPrice, page = 1, limit = 10 } = filters

//     // build query object dynamically
//     const query = { isActive: true }

//     if (category) {
//         query.categoryPath = {
//             $in: [new mongoose.Types.ObjectId(category)]
//         }
//     }

//     if (search) {
//         query.name = { $regex: search, $options: 'i' }
//     }

//     if (minPrice && isNaN(Number(minPrice))) {
//         throw new AppError('minPrice must be a number', 400)
//     }
//     if (maxPrice && isNaN(Number(maxPrice))) {
//         throw new AppError('maxPrice must be a number', 400)
//     }

//     if (minPrice || maxPrice) {
//         query.price = {}

//         if (minPrice) {
//             query.price.$gte = Number(minPrice)
//         }

//         if (maxPrice) {
//             query.price.$lte = Number(maxPrice)
//         }
//     }

//     if (attributeKey && attributeValue) {
//         query.attributes = {
//             $elemMatch: {
//                 key: attributeKey,
//                 value: attributeValue
//             }
//         }
//     }

//     const pageNum = Math.max(1, Number(page))  // minimum page is 1
//     const skip = (pageNum - 1) * limit

//     const limitNum = Math.min(Number(limit), 50)  // max 50 per page

//     const [products, total] = await Promise.all([
//         Product.find(query).populate('category', 'name slug').skip(skip).limit(limitNum),
//         Product.countDocuments(query)
//     ])


//     return {
//         products,
//         pagination: {
//             total,
//             page: pageNum,
//             limit: limitNum,
//             totalPages: Math.ceil(total / limit)
//         }
//     }
// }


// With Cursor-based pagination
const getProducts = async (filters) => {

    const { category, search, attributeKey, attributeValue, minPrice, maxPrice, cursor, limit = 10 } = filters

    const query = { isActive: true }

    if (category) {
        query.categoryPath = {
            $in: [new mongoose.Types.ObjectId(category)]
        }
    }

    if (search) {
        query.name = { $regex: search, $options: 'i' }
    }

    if (minPrice && isNaN(Number(minPrice))) {
        throw new AppError('minPrice must be a number', 400)
    }
    if (maxPrice && isNaN(Number(maxPrice))) {
        throw new AppError('maxPrice must be a number', 400)
    }

    if (minPrice || maxPrice) {
        query.price = {}

        if (minPrice) {
            query.price.$gte = Number(minPrice)
        }

        if (maxPrice) {
            query.price.$lte = Number(maxPrice)
        }
    }

    if (attributeKey && attributeValue) {
        query.attributes = {
            $elemMatch: {
                key: attributeKey,
                value: attributeValue
            }
        }
    }

    if (cursor) {
        if (!mongoose.Types.ObjectId.isValid(cursor)) {
            throw new AppError('Invalid cursor', 400)
        }
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }

    const limitNum = Math.min(Math.max(1, Number(limit) || 10), 50)

    const rows = await Product.find(query)
        .populate('category', 'name slug')
        .sort({ _id: -1 })
        .limit(limitNum + 1)

    const hasMore = rows.length > limitNum
    const products = hasMore ? rows.slice(0, limitNum) : rows
    const nextCursor = hasMore
        ? products[products.length - 1]._id.toString()
        : null

    return {
        products,
        nextCursor,
        hasMore
    }
}

const getProductFilters = async (filters) => {

    const { category } = filters

    if (!category) {
        throw new AppError('Category is required', 400)
    }

    const matchStage = { isActive: true }

    if (!mongoose.Types.ObjectId.isValid(category)) {
        throw new AppError('Invalid category ID', 400)
    }

    matchStage.categoryPath = {
            $in: [new mongoose.Types.ObjectId(category)]
        }

    const result = await Product.aggregate([

        { $match: matchStage },

        { $unwind: '$attributes' },

        {
            $group: {
                _id: '$attributes.key',
                values: { $addToSet: '$attributes.value' }
            }
        },

        {
            $project: {
                _id: 0,
                key: '$_id',
                values: 1
            }
        },

        { $sort: { key: 1 } }

    ])

    return result

}

const getProductBySlug = async (slug) => {

    const product = await Product.findOne({ slug }).populate('category', 'name slug')

    if (!product) {
        throw new AppError('Product not found', 404)
    }

    return product
}

const updateProduct = async (id, updateData) => {

    // if name is being updated, regenerate slug
    if (updateData.name) {
        updateData.slug = slugify(updateData.name)
    }

    const product = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
        // returns updated document, not original
    )

    if (!product) {
        throw new AppError('Product not found', 404)
    }

    await invalidateCache('cache:/products')

    return product
}

const deleteProduct = async (id) => {

    const product = await Product.findByIdAndUpdate(
        id,
        { isActive: false }  // soft delete
    )

    if (!product) {
        throw new AppError('Product not found', 404)
    }

    await invalidateCache('cache:/products')
}

const uploadProductImage = async (id, fileBuffer, mimetype) => {

    const product = await Product.findById(id)

    if (!product) {
        throw new AppError('Product not found', 404)
    }

    const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            { folder: 'ecommerce/products' },
            (error, result) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result)
                }
            }
        ).end(fileBuffer)
    })

    product.images.push(result.secure_url)
    await product.save()

    await invalidateCache('cache:/products')

    return product
}

module.exports = { createProduct, getProducts, getProductFilters, getProductBySlug, updateProduct, deleteProduct, uploadProductImage }