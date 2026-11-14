require('dotenv').config()

const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')
const Product = require('../models/product.model')
const Category = require('../models/category.model')
const slugify = require('../utils/slugify')

const generateAttributes = (categoryType) => {
    if (categoryType === 'phones') {
        return [
            { key: 'ram', value: faker.helpers.arrayElement(['4GB', '6GB', '8GB', '12GB']) },
            { key: 'storage', value: faker.helpers.arrayElement(['64GB', '128GB', '256GB', '512GB']) },
            { key: 'battery', value: faker.helpers.arrayElement(['4000mAh', '4500mAh', '5000mAh']) },
            { key: 'screenSize', value: faker.helpers.arrayElement(['6.1 inch', '6.5 inch', '6.7 inch']) },
            { key: 'camera', value: faker.helpers.arrayElement(['48MP', '64MP', '108MP']) }
        ]
    }

    if (categoryType === 'laptops') {
        return [
            { key: 'processor', value: faker.helpers.arrayElement(['Intel i5', 'Intel i7', 'Ryzen 5', 'Ryzen 7']) },
            { key: 'ram', value: faker.helpers.arrayElement(['8GB', '16GB', '32GB']) },
            { key: 'storage', value: faker.helpers.arrayElement(['256GB SSD', '512GB SSD', '1TB SSD']) },
            { key: 'screenSize', value: faker.helpers.arrayElement(['13 inch', '14 inch', '15.6 inch']) },
            { key: 'graphics', value: faker.helpers.arrayElement(['NVIDIA RTX 3050', 'RTX 4060', 'Integrated']) }
        ]
    }

    if (categoryType === 'clothing') {
        return [
            { key: 'size', value: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']) },
            { key: 'material', value: faker.helpers.arrayElement(['Cotton', 'Polyester', 'Wool', 'Denim']) },
            { key: 'fit', value: faker.helpers.arrayElement(['Regular', 'Slim', 'Oversized']) },
            { key: 'gender', value: faker.helpers.arrayElement(['Men', 'Women', 'Unisex']) }
        ]
    }

    if (categoryType === 'books') {
        return [
            { key: 'author', value: faker.person.fullName() },
            { key: 'language', value: faker.helpers.arrayElement(['English', 'Hindi', 'Spanish']) },
            { key: 'pages', value: faker.number.int({ min: 100, max: 1000 }).toString() },
            { key: 'genre', value: faker.helpers.arrayElement(['Fiction', 'Sci-Fi', 'Biography', 'Self-help']) },
        ]
    }

    // default — accessories
    return [
        { key: 'color', value: faker.color.human() }
    ]
}

const PRODUCT_TYPES = [
    { slug: 'phones', count: 5 },
    { slug: 'laptops', count: 4 },
    { slug: 'accessories', count: 3 },
    { slug: 'clothing', count: 5 },
    { slug: 'books', count: 3 }
]

const seedProducts = async () => {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB connected')

    let categories = await Category.find({ isActive: true })

    if (categories.length === 0) {
        await Category.insertMany(
            PRODUCT_TYPES.map((type) => ({
                name: type.slug.charAt(0).toUpperCase() + type.slug.slice(1),
                slug: type.slug,
                parent: null,
                isActive: true
            }))
        )
        console.log('Seeded categories')
        categories = await Category.find({ isActive: true })
    }

    const categoryMap = {}
    categories.forEach(cat => {
        categoryMap[cat.slug] = cat
    })

    // build categoryMap
    const buildPath = (slug) => {
        const cat = categoryMap[slug]
        if (!cat) return []

        const path = [cat._id]

        if (cat.parent) {
            path.push(cat.parent)  // parent ID already on document
        }

        return path
    }

    // check categories exist
    if (categories.length === 0) {
        console.log('No categories found. Create categories first.')
        process.exit(1)
    }

    // delete old seeded products
    await Product.deleteMany({ isSeeded: true })
    console.log('Old seeded products cleared')

    // generate products array
    const products = []

    for (const type of PRODUCT_TYPES) {
        const cat = categoryMap[type.slug]
        if (!cat) continue

        for (let i = 0; i < type.count; i++) {
            const name = faker.commerce.productName()
            products.push({
                name,
                slug: slugify(name),
                description: faker.commerce.productDescription(),
                price: Number(faker.commerce.price({ min: 500, max: 150000 })),
                quantity: faker.number.int({ min: 0, max: 200 }),
                category: cat._id,
                categoryPath: buildPath(type.slug),
                attributes: generateAttributes(type.slug),
                images: [],
                isSeeded: true,
                isActive: true
            })
        }
    }

    // insertMany
    // log success
    await Product.insertMany(products)
    console.log(`✅ ${products.length} products seeded successfully`)

    // disconnect
    await mongoose.disconnect()

    process.exit(0)
}

seedProducts().catch(err => {
    console.error('Seed failed:', err.message)
    process.exit(1)
})