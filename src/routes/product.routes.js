const express = require('express')

const router = express.Router()

const { protect } = require('../middlewares/auth.middleware')

const { publicLimiter } = require('../middlewares/rateLimit')

const { authorize } = require('../middlewares/authorize')

const upload = require('../middlewares/upload')

const validate = require('../middlewares/validate')

const { createProductSchema, updateProductSchema } = require('../validators/product.validator')

const productController = require('../controllers/product.controller')

const cacheMiddleware = require('../middlewares/cache')

router.post('/', protect, authorize('ADMIN'), validate(createProductSchema), productController.createProduct)

router.get('/', publicLimiter, cacheMiddleware(600), productController.getProducts)

router.get('/filters', publicLimiter, productController.getProductFilters)

router.get('/:slug', publicLimiter, productController.getProductBySlug)

router.put('/:id', protect, authorize('ADMIN'), validate(updateProductSchema), productController.updateProduct)

router.delete('/:id', protect, authorize('ADMIN'), productController.deleteProduct)

router.post('/:id/images', protect, authorize('ADMIN'), upload.single('image'), productController.uploadProductImage)

module.exports = router