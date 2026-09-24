const Product = require('../models/product.model')

const restoreStock = async (items) => {
    for (const line of items) {
        await Product.findByIdAndUpdate(line.productId, {
            $inc: { quantity: line.quantity }
        })
    }
}

module.exports = { restoreStock }