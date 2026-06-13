const express = require('express');
const { Category, subCategory, sub_subCategory } = require('../../Model/Admin/categoryModel');
const { Product } = require('../../Model/Admin/productModel');
const router = express.Router();

// HOME PAGE 
router.get('/', async (req, res, next) => {
    try {
        return res.render('Products/home');
    } catch (error) {
        console.error("HOME route error:", error);
        return next(error);
    }
});

// CATEGORY PRODUCT PAGE 

// ADIMIN THE DATE SHOW THE MAIN HOME PAGE
router.get('/products', async (req, res, next) => {
    try {

        const products = await Product.find({ status: 'active' })
        return res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });

    } catch (error) {
        console.error("GET /products error:", error);
        next(error);
    }
});

// ADIMIN - ALL CATEGORY
router.get('/allCategory', async (req, res, next) => {
    try {
        const categories = await Category.find({status: 'active'})
            .sort({ categoryName: 1 });

        if (!categories || categories.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No categories found",
                data: []
            });
        }

        const transformedCategory = categories.map((cat) => ({
            id: cat._id,
            name: cat.categoryName,
            icon: cat.icon || null,
            description: cat.description || null,
            categoryImage: cat.categoryImage || null,
            status: cat.status
        }));

        return res.status(200).json({
            success: true,
            count: transformedCategory.length,
            data: transformedCategory
        });

    } catch (error) {
        console.error("GET /allCategory error:", error);
        next(error);
    }
});

// ADIMIN - ALL SUBCATEGORY
router.get('/allsubCategory', async (req, res, next) => {
    try {
        const subcategories = await subCategory
            .find()
            .sort({ subcategoryName: 1 })
            .populate('parentCategory', 'categoryName');

        if (!subcategories || subcategories.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No subcategories found",
                data: []
            });
        }

        const transformedSubCategory = subcategories.map((item) => ({
            id: item._id,
            parentName: item.parentCategory?.categoryName || null,
            name: item.subcategoryName,
            icon: item.icon || null,
            description: item.description || null,
            subcategoryImage: item.subcategoryImage || null,
            status: item.status
        }));

        return res.status(200).json({
            success: true,
            count: transformedSubCategory.length,
            data: transformedSubCategory
        });

    } catch (error) {
        console.error("GET /allsubCategory error:", error);
        next(error);
    }
});

// ADIMIN - ALL SUB_SUBCATEGORY
router.get('/allsub_subCategory', async (req, res, next) => {
    try {
        const sub_subcategories = await sub_subCategory
            .find()
            .sort({ subSubName: 1 })
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName');

        if (!sub_subcategories || sub_subcategories.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No sub-subcategories found",
                data: []
            });
        }

        const transformed = sub_subcategories.map((item) => ({
            id: item._id,
            parentName: item.parentCategory?.categoryName || null,
            subParentName: item.subparentCategory?.subcategoryName || null,
            name: item.subSubName,
            icon: item.subSubIcon || null,
            description: item.subSubDesc || null,
            sub_subcategoryImages: item.sub_subcategoryImages || null,
            status: item.subSubStatus
        }));

        return res.status(200).json({
            success: true,
            count: transformed.length,
            data: transformed
        });

    } catch (error) {
        console.error("GET /allsub_subCategory error:", error);
        next(error);
    }
});

// ADMIN PRODUCTS PAGE
router.get('/allproduct', async (req, res, next) => {
    try {

        const products = await Product.find({status: 'active'})
            .populate('category', 'categoryName')
            .populate('subcategory', 'subcategoryName')
            .populate('sub_subcategory', 'subSubName').lean();

        return res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });

    } catch (error) {
        console.error("GET /products error:", error);
        next(error);
    }
});

// CATEGORY PAGE
router.get('/category/:id', async (req, res, next) => {
    
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send('Category ID is required');
        }

        const category = await Category.findById(id).lean();

        if (!category) {
            return res.status(404).send('Category not found');
        }

        return res.render('Products/category', {
            category
        });

    } catch (error) {
        console.error("PRODUCT route error:", error);
        next(error); 
    }
});

// CATEGORY PRODUCTS
router.get('/categorie/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // ✅ Validate ObjectId
        if (!id) {
            return res.status(400).send('Category ID is required');
        }

        // ✅ Fetch category
        const categoryInfo = await Category.findById(id).lean();

        if (!categoryInfo) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // ✅ Fetch products
        const productsList = await Product.find({
            category: id,
            status: 'active'
        })
        .populate('category', 'categoryName')
        .lean();

        // ✅ Response
        return res.status(200).json({
            success: true,
            count: productsList.length,
            category: {
                id: categoryInfo._id,
                name: categoryInfo.categoryName,
                description: categoryInfo.description,
                image: categoryInfo.categoryImage || null
            },
            products: productsList.map(product => ({
                id: product._id,
                productName: product.productName,
                brand: product.brand,
                price: product.price,
                comparePrice: product.comparePrice,
                offerPercent : product.offerPercent,
                mainImage: product.mainImage,
                shortDescription: product.shortDescription,
                stockQuantity: product.stockQuantity,
                status: product.status,
            }))
        });

    } catch (error) {
        console.error('GET /category/:id error:', error);
        return next(error); // ✅ proper error handling
    }
});

// SUBCATEGORY PRODUCTS
router.get('/subcategory/:id', async (req, res, next) => {
    const { id } = req.params;

    try {
        if (!id) {
            return res.status(400).send('Category ID is required');
        }

        const subcategory = await subCategory.findById(id).lean();

        if (!subcategory) {
            return res.status(404).send('subCategory not found');
        }

        return res.render('Products/subcategory', {
            subcategory
        });

    } catch (error) {
        console.error("PRODUCT route error:", error);
        next(error); 
    }
});

// SUBCATEGORY PRODUCTS
router.get('/subcategorie/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // ✅ Validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid subcategory ID"
            });
        }

        // ✅ Fetch category
        const subcategoryInfo = await subCategory.findById(id).lean();

        if (!subcategoryInfo) {
            return res.status(404).json({
                success: false,
                message: 'Subcategory not found'
            });
        }

        // ✅ Fetch products
        const productsList = await Product.find({
            subcategory: id,
            status: 'active'
        })
        .populate('category', 'categoryName')
        .lean();

        // ✅ Response
        return res.status(200).json({
            success: true,
            count: productsList.length,
            subcategory: {
                id: subcategoryInfo._id,
                name: subcategoryInfo.subcategoryName,
                description: subcategoryInfo.description,
                image: subcategoryInfo.subcategoryImage || null
            },
            products: productsList.map(product => ({
                id: product._id,
                productName: product.productName,
                brand: product.brand,
                price: product.price,
                comparePrice: product.comparePrice,
                offerPercent : product.offerPercent,
                mainImage: product.mainImage,
                shortDescription: product.shortDescription,
                stockQuantity: product.stockQuantity,
                status: product.status,
            }))
        });

    } catch (error) {
        console.error('GET /subcategory/:id error:', error);
        return next(error); // ✅ proper error handling
    }
});

// SUB_SUBCATEGORY PRODUCTS
router.get('/sub_subcategory/:id', async (req, res, next) => {
    const { id } = req.params;

    try {
        if (!id) {
            return res.status(400).send('sub_subCategory ID is required');
        }

        const sub_subcategory = await sub_subCategory.findById(id).lean();

        if (!sub_subcategory) {
            return res.status(404).send('subCategory not found');
        }

        return res.render('Products/sub_subcategory', {
            sub_subcategory
        });

    } catch (error) {
        console.error("PRODUCT route error:", error);
        next(error); 
    }
});

// SUB_SUBCATEGORY PRODUCTS
router.get('/sub_subcategorie/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        // ✅ Validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid sub_subcategory ID"
            });
        }

        // ✅ Fetch category
        const sub_subcategoryInfo = await sub_subCategory.findById(id).lean();

        if (!sub_subcategoryInfo) {
            return res.status(404).json({
                success: false,
                message: 'sub_Subcategory not found'
            });
        }

        // ✅ Fetch products
        const productsList = await Product.find({
            subcategory: id,
            status: 'active'
        })
        .populate('category', 'categoryName')
        .lean();

        // ✅ Response
        return res.status(200).json({
            success: true,
            count: productsList.length,
            sub_subcategory: {
                id: sub_subcategoryInfo._id,
                name: sub_subcategoryInfo.subSubName,
                description: sub_subcategoryInfo.subSubDesc,
                image: sub_subcategoryInfo.sub_subcategoryImages || null
            },
            products: productsList.map(product => ({
                id: product._id,
                productName: product.productName,
                brand: product.brand,
                price: product.price,
                comparePrice: product.comparePrice,
                offerPercent : product.offerPercent,
                mainImage: product.mainImage,
                shortDescription: product.shortDescription,
                stockQuantity: product.stockQuantity,
                status: product.status,
            }))
        });

    } catch (error) {
        console.error('GET /subcategory/:id error:', error);
        return next(error); // ✅ proper error handling
    }
});

// ADIMIN THE DATE SHOW THE MAIN HOME PAGE
router.get('/singleproduct/:id', async (req, res, next) => {
    try {

        const { id } = req.params;

        // ✅ Validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // ✅ Fetch products
        const products = await Product.findById(id).lean();

        if (!products) {
            return res.status(404).send('product not found');
        }

        return res.render('Products/singleproduct', {
            products
        });

    } catch (error) {
        console.error("GET /products error:", error);
        next(error);
    }
});

router.get('/singleproducts/:id', async (req, res, next) => {
    try {

        const { id } = req.params;

        // ✅ Validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }
    

        const products = await Product.findById(id).populate('category', 'categoryName')
        return res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });

    } catch (error) {
        console.error("GET /products error:", error);
        next(error);
    }
});



module.exports = router;