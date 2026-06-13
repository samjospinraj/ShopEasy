const express = require('express');
const upload = require('../../Multer/multer');
const { Category, subCategory, sub_subCategory } = require('../../Model/Admin/categoryModel');
const { Product } = require('../../Model/Admin/productModel');
const { Signup } = require('../../Model/User/userAuther');
const mongoose = require('mongoose');
const Order = require('../../Model/User/orderModel');
const { render } = require('ejs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendOTPEmail } = require('../../utils/emailService');
const Review = require('../../Model/User/reviewModel');
require('dotenv').config();

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    return res.redirect('/admin');
};

// ADMIN LOGIN PAGE 
router.get('/', async (req, res) => {
    try {
        if (req.session?.isAuthenticated) {
            return res.redirect('/admin/dashboard');
        }

        return res.render('Admin/login', {
            title: "Admin login page"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send("Server error");
    }
});

// ADMIN LOGIN PAGE USING POSST AND SESSION
router.post('/login',  async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const adminName = process.env.ADMIN_USERNAME;
        const adminPassword = process.env.ADMIN_PASSWORD;

        console.log('Login attempt:', { username });

        if (username === adminName && password === adminPassword) {

            req.session.isAuthenticated = true;
            req.session.user = {
                username: adminName,
                loggedInAt: new Date()
            };

            return req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).send("Internal server error");
                }

                return res.redirect('/admin/dashboard');
            });

        } else {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Server error"
        });
    }
});

// ADMIN DASHBOARD PAGE
router.get('/dashboard', isAuthenticated , async (req, res) => {

    try {

        return res.render('../Views/Admin/dashboard', { title: "Dashboard" });

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

// ===================== PRODUCT PART ====================

// ADMIN PRODUCTS PAGE
router.get('/product', isAuthenticated , async (req, res, next) => {

    try {

        res.render('../Views/Admin/product');

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

// ADMIN PRODUCTS PAGE
router.get('/allproduct', async (req, res, next) => {
    try {

        const products = await Product.find()
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

// ADMIN SINGLE PRODUCTS PAGE
router.get('/singleProduct/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id).lean();

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.render('../Views/Admin/singleProduct');

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
        next();
    }
});

// ================================== PRODUCT FORM START =====================
// ADMIN PRODUCTS FORM PAGE
router.get('/productForm', isAuthenticated , async (req, res, next) => {

    try {
        res.render('../Views/Admin/productForm');
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "server error" });
        next();
    }

});

//ADMIN- PRODUCTS FORM POST METHODE
router.post( "/productForm", isAuthenticated ,
    upload.fields([
        { name: "mainImage", maxCount: 1 },
        { name: "additionalImages", maxCount: 5 },
        { name: "productVideos", maxCount: 5 }
    ]),
    async (req, res) => {
        try {

            // ================= FILES =================
            const mainImageFile = req.files?.mainImage?.[0] || null;

            const mainImage = mainImageFile ? {
                filename: mainImageFile.filename,
                path: `/Uploads/mainProduct/${mainImageFile.filename}`,
                size: mainImageFile.size,
                mimetype: mainImageFile.mimetype
            } : null;

            const additionalImages = (req.files?.additionalImages || []).map(f => ({
                filename: f.filename,
                path: `/Uploads/Product/${f.filename}`,
                size: f.size,
                mimetype: f.mimetype
            }));

            const productVideos = (req.files?.productVideos || []).map(f => ({
                filename: f.filename,
                path: `/Uploads/Video/${f.filename}`,
                size: f.size,
                mimetype: f.mimetype
            }));


            // ================= BODY =================
            const {
                productName, sku, brand, model,
                category, subcategory, sub_subcategory,
                size, price, comparePrice, costPrice,
                offerPercent, stockQuantity, lowStockThreshold,
                barcode,
                keySpecs, detailedSpecs, designSpecs, perfSpecs, additionalSpecs,
                specTitle, designTitle, performanceTitle, additionalTitle,
                shortDescription, fullDescription,
                shippingClass, freeShipping,
                length, width, height, weight, shippingCost, minDay, maxDay,
                status, visibility,
                tags, internalNotes
            } = req.body;


            // ================= ERRORS =================
            const errors = [];

            if (!productName?.trim()) errors.push("Product name is required");
            if (!sku?.trim()) errors.push("SKU is required");
            if (!brand?.trim()) errors.push("Brand is required");
            if (!model?.trim()) errors.push("Model is required");
            if (!mainImage) errors.push("mainImage is required");

            if (!category) errors.push("Category is required");
            // if(!minDay) errors.push("Minimum delivery days is required");
            // if(!maxDay) errors.push("Maximum delivery days is required");
            // if (!subcategory) errors.push("Subcategory is required");
            // if (!sub_subcategory) errors.push("Sub subcategory is required");

            if (!price || isNaN(price)) errors.push("Invalid price");

            if (stockQuantity == null || isNaN(stockQuantity)) errors.push("Invalid stock");

            const validSizes = ["S", "M", "L", "XL", "NONE"];
            const normalizedSize = size?.toString()?.toUpperCase();
            if (normalizedSize && !validSizes.includes(normalizedSize)) {
                errors.push("Invalid size");
            }

            if (errors.length) {
                return res.status(400).json({ success: false, errors });
            }


            // ================= VALIDATE RELATIONS =================
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(404).json({ message: "Category not found" });
            }

            const subcategoryExists = subcategory ? await subCategory.findById(subcategory) : null;
            // if (!subcategoryExists) {
            //     return res.status(404).json({ message: "Subcategory not found" });
            // }

            // const subSubCategoryExists = await sub_subCategory.findById(sub_subcategory);
            // if (!subSubCategoryExists) {
            //     return res.status(404).json({ message: "Sub-subcategory not found" });
            // }

            if (productVideos.length > 5) {
                return res.status(400).json({ message: "Maximum 5 videos allowed" });
            }

            if (productVideos.some(v => !v.mimetype.startsWith("video/"))) {
                return res.status(400).json({ message: "All product videos must be video files" });
            }

            if (productVideos.some(v => v.size > 200 * 1024 * 1024)) {
                return res.status(400).json({ message: "Each video must be less than 200MB" });
            }

            if (additionalImages.some(img => !img.mimetype.startsWith("image/"))) {
                return res.status(400).json({ message: "All additional images must be image files" });
            }

            if (additionalImages.length > 5) {
                return res.status(400).json({ message: "Maximum 5 additional images allowed" });
            }

            if (additionalImages.some(img => img.size > 5 * 1024 * 1024)) {
                return res.status(400).json({ message: "Each additional image must be less than 5MB" });
            }

            if (mainImageFile && !mainImageFile.mimetype.startsWith("image/")) {
                return res.status(400).json({ message: "Main image must be an image file" });
            }

            if (mainImageFile && mainImageFile.size > 5 * 1024 * 1024) {
                return res.status(400).json({ message: "Main image size must be less than 5MB" });
            }

            if (mainImageFile && !mainImageFile.mimetype.startsWith("image/")) {
                return res.status(400).json({ message: "Main image must be an image file" });
            }

            const nameLength = productName?.trim()?.length;

            if (!nameLength || nameLength < 3 || nameLength > 100) {
                return res.status(400).json({
                    message: "Product name must be between 3 and 100 characters"
                });
            }

            if (sku.length < 3 || sku.length > 60) {
                return res.status(400).json({
                    message: "SKU must be between 3 and 60 characters"
                });
            }

            if (brand && (brand.length < 2 || brand.length > 60)) {
                return res.status(400).json({
                    message: "Brand must be between 2 and 60 characters"
                });
            }

            if (model && (model.length < 1 || model.length > 60)) {
                return res.status(400).json({
                    message: "Model must be between 1 and 60 characters"
                });
            }

            if (shortDescription && (shortDescription.length < 3 || shortDescription.length > 300)) {
                return res.status(400).json({
                    message: "Short description must be between 3 and 300 characters"
                });
            }

            if (fullDescription && (fullDescription.length < 3 || fullDescription.length > 2000)) {
                return res.status(400).json({
                    message: "Full description must be between 3 and 2000 characters"
                });
            }

            if (isNaN(price) || price < 0) {
                return res.status(400).json({ message: "Price must be a non-negative number" });
            }

            if (isNaN(stockQuantity) || stockQuantity < 0) {
                return res.status(400).json({ message: "Stock quantity must be a non-negative integer" });
            }

            if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
                return res.status(400).json({ message: "Low stock threshold must be a non-negative integer" });
            }

            if (barcode && (barcode.length < 3 || barcode.length > 60)) {
                return res.status(400).json({ message: "Barcode must be between 3 and 60 characters" });
            }

            if (tags && typeof tags === "string" && tags.length > 200) {
                return res.status(400).json({ message: "Tags cannot exceed 200 characters" });
            }

            if (internalNotes && internalNotes.length > 500) {
                return res.status(400).json({ message: "Internal notes cannot exceed 500 characters" });
            }

            if (specTitle && (specTitle.length < 3 || specTitle.length > 100)) {
                return res.status(400).json({ message: "Specification title must be between 3 and 100 characters" });
            }

            if (designTitle && (designTitle.length < 3 || designTitle.length > 100)) {
                return res.status(400).json({ message: "Design title must be between 3 and 100 characters" });
            }

            if (performanceTitle && (performanceTitle.length < 3 || performanceTitle.length > 100)) {
                return res.status(400).json({ message: "Performance title must be between 3 and 100 characters" });
            }

            if (additionalTitle && (additionalTitle.length < 3 || additionalTitle.length > 100)) {
                return res.status(400).json({ message: "Additional title must be between 3 and 100 characters" });
            }

            if (length && (isNaN(length) || length < 0)) {
                return res.status(400).json({ message: "Length must be a non-negative number" });
            }

            if (width && (isNaN(width) || width < 0)) {
                return res.status(400).json({ message: "Width must be a non-negative number" });
            }

            if (height && (isNaN(height) || height < 0)) {
                return res.status(400).json({ message: "Height must be a non-negative number" });
            }

            if (weight && (isNaN(weight) || weight < 0)) {
                return res.status(400).json({ message: "Weight must be a non-negative number" });
            }

            if (shippingCost && (isNaN(shippingCost) || shippingCost < 0)) {
                return res.status(400).json({ message: "Shipping cost must be a non-negative number" });
            }

            if (offerPercent && (isNaN(offerPercent) || offerPercent < 0 || offerPercent > 100)) {
                return res.status(400).json({ message: "Offer percent must be between 0 and 100" });
            }

            if (status && !["draft", "active", "archived"].includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }

            if (visibility && !["visible", "hidden"].includes(visibility)) {
                return res.status(400).json({ message: "Invalid visibility value" });
            }

            if (freeShipping && typeof freeShipping !== "boolean" && freeShipping !== "true" && freeShipping !== "false") {
                return res.status(400).json({ message: "Free shipping must be a boolean value" });
            }

            if (productVideos.some(v => !v.mimetype.startsWith("video/"))) {
                return res.status(400).json({ message: "All product videos must be video files" });
            }

            if (additionalImages.some(img => !img.mimetype.startsWith("image/"))) {
                return res.status(400).json({ message: "All additional images must be image files" });
            }

            if (minDay && (isNaN(minDay) || minDay < 0 || minDay > 365)) {
                return res.status(400).json({ message: "Minimum days must be between 0 and 365" });
            }

            if (maxDay && (isNaN(maxDay) || maxDay < 0 || maxDay > 365)) {
                return res.status(400).json({ message: "Maximum days must be between 0 and 365" });
            }

            if (minDay && maxDay && parseInt(minDay) > parseInt(maxDay)) {
                return res.status(400).json({ message: "Minimum days cannot be greater than maximum days" });
            }

            if (maxDay && minDay && parseInt(maxDay) < parseInt(minDay)) {
                return res.status(400).json({ message: "Maximum days cannot be less than minimum days" });
            }

            const subSubCategoryExists = sub_subcategory
                ? await sub_subCategory.findById(sub_subcategory)
                : null;


            // ================= DUPLICATE SKU =================
            const existing = await Product.findOne({ sku });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "SKU already exists"
                });
            }


            // ================= OFFER =================
            let finalOffer = parseFloat(offerPercent) || 0;

            if (!finalOffer && comparePrice && price) {
                finalOffer = ((comparePrice - price) / comparePrice) * 100;
            }

            const parseArray = (data) => {
                if (!data) return [];

                if (Array.isArray(data)) return data;

                try {
                    return JSON.parse(data);
                } catch (e) {
                    return data.split(",").map(i => i.trim());
                }
            };

            // ================= PRODUCT DATA =================
            const productData = {
                productName: productName.trim(),
                sku: sku.trim().toUpperCase(),
                brand,
                model,

                category,
                subcategory,
                sub_subcategory,

                size: normalizedSize,
                price: parseFloat(price),
                comparePrice: parseFloat(comparePrice) || 0,
                costPrice: parseFloat(costPrice) || 0,
                offerPercent: finalOffer,

                stockQuantity: parseInt(stockQuantity),
                lowStockThreshold: parseInt(lowStockThreshold) || 5,

                barcode: barcode || null,

                specTitle: specTitle || null,
                designTitle: designTitle || null,
                performanceTitle: performanceTitle || null,
                additionalTitle: additionalTitle || null,

                keySpecs: parseArray(keySpecs),
                detailedSpecs: parseArray(detailedSpecs),
                designSpecs: parseArray(designSpecs),
                perfSpecs: parseArray(perfSpecs),
                additionalSpecs: parseArray(additionalSpecs),
                shortDescription,
                fullDescription,

                shippingClass,
                freeShipping: freeShipping === "true" || freeShipping === true,

                dimensions: {
                    length: parseFloat(length) || 0,
                    width: parseFloat(width) || 0,
                    height: parseFloat(height) || 0,
                    weight: parseFloat(weight) || 0,
                    shippingCost: parseFloat(shippingCost) || 0
                },

                delivery: {
                    minDay: parseInt(minDay) || 0,
                    maxDay: parseInt(maxDay) || 0
                },

                mainImage,
                additionalImages,
                productVideos,

                status: status || "draft",
                visibility: visibility || "visible",

                tags: typeof tags === "string"
                    ? tags.split(",").map(t => t.trim())
                    : [],

                internalNotes: internalNotes || ""
            };


            // ================= SAVE =================
            const product = await Product.create(productData);


            // ================= POPULATE =================
            const populatedProduct = await Product.findById(product._id)
                .populate("category", "categoryName")
                .populate("subcategory", "subcategoryName")
                .populate("sub_subcategory", "subSubName").lean();

            console.log("Product created successfully;", populatedProduct)

            return res.status(201).json({
                success: true,
                message: "Product created successfully",
                data: populatedProduct
            });

        } catch (err) {
            console.error("Product Create Error:", err);
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);

// ADMIN EDIT PRODUCTFORM PAGE AND ID
router.get('/editproductForm/:id', isAuthenticated , async (req, res, next) => {
    try {

        const { id } = req.params;

        const product = await Product.findById(id)
            .populate('category', 'categoryName')
            .populate('subcategory', 'subcategoryName')
            .populate('sub_subcategory', 'subSubName');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.status(200).render('Admin/productForm', {
            product,
            editMode: true
        });

    } catch (error) {
        console.error("Edit product GET error:", error);
        next(error);
    }
});

router.get('/productForm/:id', isAuthenticated , async (req, res, next) => {
    try {

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        const productData = await Product.findById(id)
            .populate('category', 'categoryName')
            .populate('subcategory', 'subcategoryName')
            .populate('sub_subcategory', 'subSubName').lean();

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            data: productData
        });

    } catch (error) {
        console.error("GET product by ID error:", error);
        next(error);
    }
});

//ADMIN- PRODUCTS FORM PUT METHODE - EDIT
router.put("/editproductForm/:id", isAuthenticated ,
    upload.fields([
        { name: "mainImage", maxCount: 1 },
        { name: "additionalImages", maxCount: 5 },
        { name: "productVideos", maxCount: 3 }
    ]),
    async (req, res) => {
        try {

            const { id } = req.params;

            // ================= FIND PRODUCT =================
            const existingProduct = await Product.findById(id);
            if (!existingProduct) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            // ================= SAFE JSON PARSE =================
            const safeParse = (data) => {
                try {
                    return data ? JSON.parse(data) : [];
                } catch {
                    return [];
                }
            };

            // ================= FILES =================
            const mainImageFile = req.files?.mainImage?.[0];

            const mainImage = mainImageFile
                ? {
                    filename: mainImageFile.filename,
                    path: `/Uploads/mainProduct/${mainImageFile.filename}`,
                    size: mainImageFile.size,
                    mimetype: mainImageFile.mimetype
                }
                : existingProduct.mainImage;

            if (!mainImage) {
                return res.status(400).json({
                    success: false,
                    message: "Main image is required"
                });
            }

            // ================= IMAGES =================
            const existingImages = safeParse(req.body.existingImages);
            const removedImages = safeParse(req.body.removedImages);

            const additionalImages = [
                ...existingImages.filter(img => !removedImages.includes(img.filename)),
                ...(req.files?.additionalImages || []).map(f => ({
                    filename: f.filename,
                    path: `/Uploads/Product/${f.filename}`,
                    size: f.size,
                    mimetype: f.mimetype
                }))
            ];

            // ================= VIDEOS =================
            const existingVideos = safeParse(req.body.existingVideos);
            const removedVideos = safeParse(req.body.removedVideos);

            const productVideos = [
                ...existingVideos.filter(v => !removedVideos.includes(v.filename)),
                ...(req.files?.productVideos || []).map(f => ({
                    filename: f.filename,
                    path: `/Uploads/Video/${f.filename}`,
                    size: f.size,
                    mimetype: f.mimetype
                }))
            ];

            // ================= BODY =================
            const {
                productName, sku, brand, model,
                category, subcategory, sub_subcategory,
                size, price, comparePrice, costPrice,
                offerPercent, stockQuantity, lowStockThreshold,
                barcode,
                keySpecs, detailedSpecs, designSpecs, perfSpecs, additionalSpecs,
                specTitle, designTitle, performanceTitle, additionalTitle,
                shortDescription, fullDescription,
                shippingClass, freeShipping,
                length, width, height, weight, shippingCost, minDay, maxDay,
                status, visibility,
                tags, internalNotes
            } = req.body;

            // ================= VALIDATION =================
            const errors = [];

            if (!productName) errors.push("Product name required");
            if (!sku) errors.push("SKU required");
            if (!category) {
                errors.push("Category is required");
            } else {
                const categoryExists = await Category.findById(category);
                if (!categoryExists) {
                    errors.push("Category not found");
                }
            }

            if (subcategory) {
                const subcategoryExists = await subCategory.findById(subcategory);
                if (!subcategoryExists) {
                    errors.push("Subcategory not found");
                }
            }

            if (sub_subcategory) {
                const subSubCategoryExists = await sub_subCategory.findById(sub_subcategory);
                if (!subSubCategoryExists) {
                    errors.push("Sub-subcategory not found");
                }
            }

            const validSizes = ["S", "M", "L", "XL" , "NONE"];
            const normalizedSize = size?.toString()?.toUpperCase();
            if (normalizedSize && !validSizes.includes(normalizedSize)) {
                errors.push("Invalid size");
            }

            if (errors.length) {
                return res.status(400).json({ success: false, errors });
            }

            // ================= SKU CHECK =================
            const duplicateSku = await Product.findOne({
                sku: sku.trim(),
                _id: { $ne: id }
            });

            if (duplicateSku) {
                return res.status(409).json({
                    success: false,
                    message: "SKU already exists"
                });
            }

            // ================= OFFER =================
            let finalOffer = parseFloat(offerPercent) || existingProduct.offerPercent;

            if (!finalOffer && comparePrice && price) {
                finalOffer = ((comparePrice - price) / comparePrice) * 100;
            }

            if (productVideos.length > 5) {
                return res.status(400).json({ message: "Maximum 5 videos allowed" });
            }

            if (productVideos.some(v => !v.mimetype.startsWith("video/"))) {
                return res.status(400).json({ message: "All product videos must be video files" });
            }

            if (productVideos.some(v => v.size > 200 * 1024 * 1024)) {
                return res.status(400).json({ message: "Each video must be less than 200MB" });
            }

            if (additionalImages.some(img => !img.mimetype.startsWith("image/"))) {
                return res.status(400).json({ message: "All additional images must be image files" });
            }

            if (additionalImages.length > 5) {
                return res.status(400).json({ message: "Maximum 5 additional images allowed" });
            }

            if (additionalImages.some(img => img.size > 5 * 1024 * 1024)) {
                return res.status(400).json({ message: "Each additional image must be less than 5MB" });
            }

            if (mainImageFile && !mainImageFile.mimetype.startsWith("image/")) {
                return res.status(400).json({ message: "Main image must be an image file" });
            }

            if (mainImageFile && mainImageFile.size > 5 * 1024 * 1024) {
                return res.status(400).json({ message: "Main image size must be less than 5MB" });
            }

            if (mainImageFile && !mainImageFile.mimetype.startsWith("image/")) {
                return res.status(400).json({ message: "Main image must be an image file" });
            }

            const nameLength = productName?.trim()?.length;

            if (!nameLength || nameLength < 3 || nameLength > 100) {
                return res.status(400).json({
                    message: "Product name must be between 3 and 100 characters"
                });
            }

            if (sku.length < 3 || sku.length > 60) {
                return res.status(400).json({
                    message: "SKU must be between 3 and 60 characters"
                });
            }

            if (brand && (brand.length < 2 || brand.length > 60)) {
                return res.status(400).json({
                    message: "Brand must be between 2 and 60 characters"
                });
            }

            if (model && (model.length < 1 || model.length > 60)) {
                return res.status(400).json({
                    message: "Model must be between 1 and 60 characters"
                });
            }

            if (shortDescription && (shortDescription.length < 3 || shortDescription.length > 300)) {
                return res.status(400).json({
                    message: "Short description must be between 3 and 300 characters"
                });
            }

            if (fullDescription && (fullDescription.length < 3 || fullDescription.length > 2000)) {
                return res.status(400).json({
                    message: "Full description must be between 3 and 2000 characters"
                });
            }

            if (isNaN(price) || price < 0) {
                return res.status(400).json({ message: "Price must be a non-negative number" });
            }

            if (isNaN(stockQuantity) || stockQuantity < 0) {
                return res.status(400).json({ message: "Stock quantity must be a non-negative integer" });
            }

            if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
                return res.status(400).json({ message: "Low stock threshold must be a non-negative integer" });
            }

            if (barcode && (barcode.length < 3 || barcode.length > 60)) {
                return res.status(400).json({ message: "Barcode must be between 3 and 60 characters" });
            }

            if (tags && typeof tags === "string" && tags.length > 200) {
                return res.status(400).json({ message: "Tags cannot exceed 200 characters" });
            }

            if (internalNotes && internalNotes.length > 500) {
                return res.status(400).json({ message: "Internal notes cannot exceed 500 characters" });
            }

            if (specTitle && (specTitle.length < 3 || specTitle.length > 100)) {
                return res.status(400).json({ message: "Specification title must be between 3 and 100 characters" });
            }

            if (designTitle && (designTitle.length < 3 || designTitle.length > 100)) {
                return res.status(400).json({ message: "Design title must be between 3 and 100 characters" });
            }

            if (performanceTitle && (performanceTitle.length < 3 || performanceTitle.length > 100)) {
                return res.status(400).json({ message: "Performance title must be between 3 and 100 characters" });
            }

            if (additionalTitle && (additionalTitle.length < 3 || additionalTitle.length > 100)) {
                return res.status(400).json({ message: "Additional title must be between 3 and 100 characters" });
            }

            if (length && (isNaN(length) || length < 0)) {
                return res.status(400).json({ message: "Length must be a non-negative number" });
            }

            if (width && (isNaN(width) || width < 0)) {
                return res.status(400).json({ message: "Width must be a non-negative number" });
            }

            if (height && (isNaN(height) || height < 0)) {
                return res.status(400).json({ message: "Height must be a non-negative number" });
            }

            if (weight && (isNaN(weight) || weight < 0)) {
                return res.status(400).json({ message: "Weight must be a non-negative number" });
            }

            if (shippingCost && (isNaN(shippingCost) || shippingCost < 0)) {
                return res.status(400).json({ message: "Shipping cost must be a non-negative number" });
            }

            if (offerPercent && (isNaN(offerPercent) || offerPercent < 0 || offerPercent > 100)) {
                return res.status(400).json({ message: "Offer percent must be between 0 and 100" });
            }

            if (status && !["draft", "active", "archived"].includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }

            if (visibility && !["visible", "hidden"].includes(visibility)) {
                return res.status(400).json({ message: "Invalid visibility value" });
            }

            if (freeShipping && typeof freeShipping !== "boolean" && freeShipping !== "true" && freeShipping !== "false") {
                return res.status(400).json({ message: "Free shipping must be a boolean value" });
            }

            if (productVideos.some(v => !v.mimetype.startsWith("video/"))) {
                return res.status(400).json({ message: "All product videos must be video files" });
            }

            if (additionalImages.some(img => !img.mimetype.startsWith("image/"))) {
                return res.status(400).json({ message: "All additional images must be image files" });
            }

            if (minDay && (isNaN(minDay) || minDay < 0 || minDay > 365)) {
                return res.status(400).json({ message: "Minimum days must be between 0 and 365" });
            }

            if (maxDay && (isNaN(maxDay) || maxDay < 0 || maxDay > 365)) {
                return res.status(400).json({ message: "Maximum days must be between 0 and 365" });
            }

            if (minDay && maxDay && parseInt(minDay) > parseInt(maxDay)) {
                return res.status(400).json({ message: "Minimum days cannot be greater than maximum days" });
            }

            if (maxDay && minDay && parseInt(maxDay) < parseInt(minDay)) {
                return res.status(400).json({ message: "Maximum days cannot be less than minimum days" });
            }

            // ================= UPDATE DATA =================
            const updateData = {
                productName,
                sku: sku.toUpperCase(),
                brand,
                model,

                category,
                subcategory,
                sub_subcategory,

                size: normalizedSize,
                price: parseFloat(price),
                comparePrice: parseFloat(comparePrice) || 0,
                costPrice: parseFloat(costPrice) || 0,

                offerPercent: finalOffer,
                stockQuantity: parseInt(stockQuantity),
                lowStockThreshold: parseInt(lowStockThreshold) || 5,

                barcode: barcode || null,

                specTitle: specTitle || null,
                designTitle: designTitle || null,
                performanceTitle: performanceTitle || null,
                additionalTitle: additionalTitle || null,


                keySpecs: safeParse(keySpecs),
                detailedSpecs: safeParse(detailedSpecs),
                designSpecs: safeParse(designSpecs),
                perfSpecs: safeParse(perfSpecs),
                additionalSpecs: safeParse(additionalSpecs),

                shortDescription,
                fullDescription,

                shippingClass,
                freeShipping: freeShipping === "true" || freeShipping === true,

                dimensions: {
                    length: parseFloat(length) || 0,
                    width: parseFloat(width) || 0,
                    height: parseFloat(height) || 0,
                    weight: parseFloat(weight) || 0,
                    shippingCost: parseFloat(shippingCost) || 0
                },

                delivery: {
                    minDays: parseInt(minDay) || 1,
                    maxDays: parseInt(maxDay) || 4
                },

                mainImage,
                additionalImages,
                productVideos,

                status: status || "draft",
                visibility: visibility || "visible",

                tags: typeof tags === "string"
                    ? tags.split(",").map(t => t.trim())
                    : [],

                internalNotes: internalNotes || "",
                updatedAt: new Date()
            };

            // ================= UPDATE =================
            const updatedProduct = await Product.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            )
                .populate("category", "categoryName")
                .populate("subcategory", "subcategoryName")
                .populate("sub_subcategory", "subSubName").lean();

            return res.status(200).json({
                success: true,
                message: "Product updated successfully",
                data: updatedProduct
            });

        } catch (err) {
            console.error("Update Error:", err);
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);

// ADMIN DELETED PRODUCT
router.delete('/deletedproduct/:id', isAuthenticated , async (req, res) => {
    try {
        const { id } = req.params;

        const deletedProduct = await Product.findByIdAndDelete(id).lean();

        if (!deletedProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({
            message: "Product deleted successfully",
            data: deletedProduct
        });

        console.log("Product deleted successfully : ", deletedProduct)

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

// ==================================== PRODUCTS END =============================== //

// ADMIN CATEGORY PAGE
router.get('/category', isAuthenticated , (req, res, next) => {
    try {
        res.render('Admin/category'); // cleaner path (Express already knows views folder)
    } catch (error) {
        console.error(error);
        next(error); // pass error to Express error handler
    }
});

//  ============================ categoryForm =============================

// ADMIN CATEGORYFORM PAGE
router.get('/categoryForm', isAuthenticated , (req, res, next) => {
    try {
        res.render('Admin/categoryForm');
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// ADMIN CATEGORYFORM PAGE AND POST 
router.post('/categoryForm', isAuthenticated , upload.single('categoryImage'), async (req, res, next) => {
    try {
        const { categoryName, url, icon, description, status } = req.body;

        // Validate required fields
        if (!categoryName || !url || !icon || !description || !status) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        if (categoryName.length < 3 || categoryName.length > 60) {
            return res.status(400).json({ message: "Category name must be between 3 and 60 characters" });
        }

        if (url.length < 3 || url.length > 100) {
            return res.status(400).json({ message: "URL must be between 3 and 100 characters" });
        }

        if (icon.length < 3 || icon.length > 60) {
            return res.status(400).json({ message: "Icon must be between 3 and 60 characters" });
        }

        if (description.length < 3 || description.length > 500) {
            return res.status(400).json({ message: "Description must be between 3 and 500 characters" });
        }

        if (!/^https?:\/\/\S+$/.test(url)) {
            return res.status(400).json({ message: "URL must be valid and start with http:// or https://" });
        }

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({ message: "Uploaded file must be an image" });
        }

        if (req.file && req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: "Image size must be less than 5MB" });
        }

        // Validate file upload
        if (!req.file) {
            return res.status(400).json({ message: "Category image is required" });
        }

        // Build image object
        const categoryImage = {
            filename: req.file.filename,
            path: `/Uploads/category/${req.file.filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype
        };

        const categoryData = { categoryName, url, icon, description, categoryImage, status };

        const category = await Category.insertOne(categoryData);
        console.log('category crate :', category);

        return res.status(201).json({
            success: true,
            message: 'Item created successfully',
            data: category
        });

    } catch (error) {
        console.error(error);
        next(error);
    }
});

// ADIMIN THE DATE SHOW THE MAIN CATEGORY PAGE
router.get('/categories', isAuthenticated , async (req, res, next) => {
    try {
        const categories = await Category
            .find({ status: 'active' })
            .select('categoryName icon') // cleaner than projection object
            .sort({ categoryName: 1 })
            .lean(); // returns plain JS objects (faster)

        const transformedCategories = categories.map(({ _id, categoryName, icon }) => ({
            id: _id,
            name: categoryName,
            icon: icon || null
        }));

        return res.json(transformedCategories);

    } catch (error) {
        console.error(error);
        next(error);
    }
});

// ADMIN CATEGORYFORM PAGE AND ID
router.get('/editcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id).lean();

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        res.render('../Views/Admin/categoryForm');

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
        next();
    }
});

// ADMIN CATEGORYFORM PAGE AND ID
router.get('/categoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id).lean();

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        return res.json({
            message: "Category fetched successfully",
            data: category
        });

    } catch (error) {
        console.error(error);

        // Handle invalid ObjectId specifically
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        next(error);
    }
});

// ADMIN CATEGORYFORM PAGE AND UPDATE THE FORM
router.put('/editcategoryForm/:id', isAuthenticated , upload.single('categoryImage'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { categoryName, url, icon, description, status } = req.body;

        // Validate required fields
        if (!categoryName || !url || !icon || !description || !status) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const categoryUpdateData = { categoryName, url, icon, description, status };

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        if (categoryName.length < 3 || categoryName.length > 60) {
            return res.status(400).json({ message: "Category name must be between 3 and 60 characters" });
        }

        if (url.length < 3 || url.length > 100) {
            return res.status(400).json({ message: "URL must be between 3 and 100 characters" });
        }

        if (icon.length < 3 || icon.length > 60) {
            return res.status(400).json({ message: "Icon must be between 3 and 60 characters" });
        }

        if (description.length < 3 || description.length > 500) {
            return res.status(400).json({ message: "Description must be between 3 and 500 characters" });
        }

        // if (!/^https?:\/\/\S+$/.test(url)) {
        //     return res.status(400).json({ message: "URL must be valid and start with http:// or https://" });
        // }
        

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({ message: "Uploaded file must be an image" });
        }

        if (req.file && req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: "Image size must be less than 5MB" });
        }

        // If a new file is uploaded, update image
        if (req.file) {
            categoryUpdateData.categoryImage = {
                filename: req.file.filename,
                path: `/Uploads/category/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype
            };
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            categoryUpdateData,
            { new: true, runValidators: true }
        ).lean();

        console.log('category update :', updatedCategory);

        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: updatedCategory
        });

    } catch (error) {
        console.error(error);

        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        next(error);
    }
});

// ADMIN CATEGORYFORM PAGE AND DELETE THE PAGE
router.delete('/deletecategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        const deletedCategory = await Category.findByIdAndDelete(id).lean();

        if (!deletedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.json({
            success: true,
            message: 'Category deleted successfully',
            data: deletedCategory
        });

    } catch (error) {
        console.error(error);

        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        next(error);
    }
});

//    ============================= subcategoryForm ===========================

// ADMIN CATEGORYFORM PAGE
router.get('/subcategoryForm', isAuthenticated , (req, res, next) => {
    try {
        res.render('Admin/subcategoryForm');
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// ADMIN SUBCATEGORYFORM AND POST
router.post('/subcategoryForm', isAuthenticated , upload.single('subcategoryImage'), async (req, res, next) => {
    try {
        const { parentCategory, subcategoryName, icon, status, description } = req.body;

        // Validate required fields
        if (!parentCategory || !subcategoryName || !icon || !status || !description) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check parent category
        const categoryExists = await Category.findById(parentCategory);
        if (!categoryExists) {
            return res.status(404).json({ message: "Parent category not found" });
        }

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        if (subcategoryName.length < 3 || subcategoryName.length > 60) {
            return res.status(400).json({ message: "Subcategory name must be between 3 and 60 characters" });
        }

        if (icon.length < 3 || icon.length > 60) {
            return res.status(400).json({ message: "Icon must be between 3 and 60 characters" });
        }

        if (description.length < 3 || description.length > 500) {
            return res.status(400).json({ message: "Description must be between 3 and 500 characters" });
        }

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({ message: "Uploaded file must be an image" });
        }

        if (req.file && req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: "Image size must be less than 5MB" });
        }

        // Validate file
        if (!req.file) {
            return res.status(400).json({ message: "Subcategory image is required" });
        }

        const subcategoryImage = {
            filename: req.file.filename,
            path: `/Uploads/subcategory/${req.file.filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype
        };

        const subcategoryData = { parentCategory, subcategoryName, icon, status, description, subcategoryImage };

        // ✅ Use Mongoose create instead of insertOne
        const subcategory = await subCategory.insertMany([subcategoryData]);

        // ✅ populate parentCategory name
        const populatedSubcategory = await subCategory
            .findById(subcategory._id)
            .populate('parentCategory', 'categoryName');

        console.log("Subcategory crated successfully : ", populatedSubcategory);

        return res.status(201).json({
            success: true,
            message: "Subcategory created successfully",
            data: populatedSubcategory
        });

    } catch (error) {
        console.error(error);
        next(error);
    }
});

// ADIMIN-FETCH THE DATE SHOW THE MAIN CATEGORY AND SUBCATEGORY PAGE
router.get('/subcategories', isAuthenticated , async (req, res, next) => {
    try {

        const subcategories = await subCategory
            .find({ status: 'active' })
            .select('parentCategory subcategoryName icon')
            .sort({ subcategoryName: 1 })
            .populate({
                path: 'parentCategory',
                select: 'categoryName',
                options: { strictPopulate: false } // 🔥 prevents crash
            });

        const transformedSubCategories = subcategories.map((item) => ({
            id: item._id,
            parentId: item.parentCategory?._id || null,
            parentName: item.parentCategory?.categoryName || null,
            subname: item.subcategoryName,
            icon: item.icon || null
        }));

        return res.status(200).json({
            success: true,
            count: transformedSubCategories.length,
            data: transformedSubCategories
        });

    } catch (error) {
        console.error("GET /subcategories error:", error);
        next(error);
    }
});

// ADMIN SUBCATEGORYFORM PAGE AND FRONT PAGE
router.get('/editsubcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        const subcategory = await subCategory.findById(id).lean();

        if (!subcategory) {
            return res.status(404).json({ message: "Subcategory not found" });
        }

        return res.render('Admin/subcategoryForm', {
            subcategory,
            isEdit: true
        });

    } catch (error) {
        console.error(error);
        next(error);
    }
});

// ADMIN SUBCATEGORYFORM PAGE AND ID
router.get('/subcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        const subcategory = await subCategory.findById(id).lean();

        if (!subcategory) {
            return res.status(404).json({ message: "Subcategory not found" });
        }

        return res.json({
            success: true,
            message: "Subcategory fetched successfully",
            data: subcategory
        });

    } catch (error) {
        console.error(error);

        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid subcategory ID" });
        }

        next(error);
    }
});

// ADMIN SUBCATEGORYFORM PAGE AND UPDATE DATE
router.put('/editsubcategoryForm/:id', isAuthenticated , upload.single('subcategoryImage'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { parentCategory, subcategoryName, icon, status, description } = req.body;

        // Validate Mongo ID early
        if (!id) {
            return res.status(400).json({ message: "Subcategory ID is required" });
        }

        const categoryExists = await Category.findById(parentCategory);
        if (!categoryExists) {
            return res.status(404).json({ message: "Parent category not found" });
        }

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        if (subcategoryName && (subcategoryName.length < 3 || subcategoryName.length > 60)) {
            return res.status(400).json({ message: "Subcategory name must be between 3 and 60 characters" });
        }

        if (icon && (icon.length < 3 || icon.length > 60)) {
            return res.status(400).json({ message: "Icon must be between 3 and 60 characters" });
        }

        if (description && (description.length < 3 || description.length > 500)) {
            return res.status(400).json({ message: "Description must be between 3 and 500 characters" });
        }

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({ message: "Uploaded file must be an image" });
        }

        if (req.file && req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: "Image size must be less than 5MB" });
        }

        const updateData = {};

        if (parentCategory) updateData.parentCategory = parentCategory;
        if (subcategoryName) updateData.subcategoryName = subcategoryName;
        if (icon) updateData.icon = icon;
        if (status) updateData.status = status;
        if (description) updateData.description = description;

        // Handle image update
        if (req.file) {
            updateData.subcategoryImage = {
                filename: req.file.filename,
                path: `/Uploads/subcategory/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype
            };
        }

        const updatedSubcategory = await subCategory.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        ).populate('parentCategory', 'categoryName').lean();

        console.log("Subcategory updated successfully : ", updatedSubcategory);

        if (!updatedSubcategory) {
            return res.status(404).json({ message: "Subcategory not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Subcategory updated successfully",
            data: updatedSubcategory
        });

    } catch (error) {
        console.error("Update Subcategory Error:", error);

        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid subcategory ID" });
        }

        next(error);
    }
});

// ADMIN SUBCATEGORYFORM PAGE AND DELETED DATA
router.delete('/deletesubcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Subcategory ID is required"
            });
        }

        const deletedSubcategory = await subCategory.findByIdAndDelete(id).lean();

        if (!deletedSubcategory) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found"
            });
        }

        console.log("Deleted Subcategory:", deletedSubcategory._id);

        return res.status(200).json({
            success: true,
            message: "Subcategory deleted successfully",
            data: deletedSubcategory
        });

    } catch (error) {
        console.error("DELETE subcategory error:", error);

        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid subcategory ID"
            });
        }

        next(error);
    }
});

//    =========================== sub_subcategoryForm =========================

// ADMIN SUB_SUBCATEGORY PAGE 
router.get('/sub_subcategoryForm', isAuthenticated , (req, res, next) => {
    try {
        return res.render('Admin/sub_subcategoryForm');
    } catch (error) {
        console.error("Render sub_subcategoryForm error:", error);
        next(error);
    }
});


// ADMIN SUB_SUBCATEGORY PAGE 
router.post('/sub_subcategoryForm', isAuthenticated , upload.single('sub_subcategoryImages'), async (req, res, next) => {
    try {

        const { parentCategory, subparentCategory, subSubName, subSubIcon, subSubStatus, subSubDesc } = req.body;

        // Validate required fields
        if (!parentCategory || !subparentCategory || !subSubName || !subSubIcon || !subSubStatus || !subSubDesc) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Validate parent category
        const categoryExists = await Category.findById(parentCategory);
        if (!categoryExists) {
            return res.status(404).json({
                success: false,
                message: "Parent category not found"
            });
        }

        // Validate subcategory (IMPORTANT FIX)
        const subcategoryExists = await subCategory.findById(subparentCategory);
        if (!subcategoryExists) {
            return res.status(404).json({
                success: false,
                message: "Parent subcategory not found"
            });
        }

        if (!['active', 'inactive'].includes(subSubStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        if (subSubName.length < 3 || subSubName.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory name must be between 3 and 60 characters"
            });
        }

        if (subSubIcon.length < 3 || subSubIcon.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory icon must be between 3 and 60 characters"
            });
        }

        if (subSubDesc.length < 3 || subSubDesc.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory description must be between 3 and 500 characters"
            });
        }

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({
                success: false,
                message: "Uploaded file must be an image"
            });
        }

        if (req.file && req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: "Image size must be less than 5MB"
            });
        }

        // Validate file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory image is required"
            });
        }

        const sub_subcategoryImages = {
            filename: req.file.filename,
            path: `/Uploads/sub_subcategory/${req.file.filename}`,
            size: req.file.size,
            mimetype: req.file.mimetype
        };

        const sub_subcategoryData = { parentCategory, subparentCategory, subSubName, subSubIcon, subSubStatus, subSubDesc, sub_subcategoryImages };

        // CREATE (correct Mongoose method)
        const createdSubSubCategory = await sub_subCategory.insertMany([sub_subcategoryData]);

        // Populate result
        const populatedsub_Subcategory = await sub_subCategory
            .findById(createdSubSubCategory._id)
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName').lean();

        console.log("Sub-subcategory created successfully :", populatedsub_Subcategory)

        return res.status(201).json({
            success: true,
            message: "Sub-subcategory created successfully",
            data: populatedsub_Subcategory
        });

    } catch (error) {
        console.error("POST sub_subcategory error:", error);
        next(error);
    }
});

// ADMIN SUB_SUBCATEGORY PAGE AND ID FRONT END
router.get('/editsub_subcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {

        const { id } = req.params;

        const subSubCategoryData = await sub_subCategory
            .findById(id)
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName').lean();

        if (!subSubCategoryData) {
            return res.status(404).json({
                success: false,
                message: "Sub-subcategory not found"
            });
        }

        return res.status(200).render('Admin/sub_subcategoryForm', {
            data: subSubCategoryData,
            editMode: true
        });

    } catch (error) {
        console.error("Edit sub_subcategory GET error:", error);
        next(error);
    }
});

// ADMIN SUB_SUBCATEGORY PAGE AND ID 
router.get('/sub_subcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {

        const { id } = req.params;

        // Optional: validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID is required"
            });
        }

        const subSubCategory = await sub_subCategory
            .findById(id)
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName').lean();

        if (!subSubCategory) {
            return res.status(404).json({
                success: false,
                message: "Sub-subcategory not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sub-subcategory fetched successfully",
            data: subSubCategory
        });

    } catch (error) {
        console.error("GET sub_subcategory by ID error:", error);
        next(error);
    }
});

// ADMIN SUB_SUBCATEGORY PAGE AND UPDATE
router.put('/editsub_subcategoryForm/:id', isAuthenticated , upload.single('sub_subcategoryImages'), async (req, res, next) => {
    try {

        const { id } = req.params;

        const { parentCategory, subparentCategory, subSubName, subSubIcon, subSubStatus, subSubDesc } = req.body;

        // Validate ID
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID is required"
            });
        }

        // Validate required fields
        if (!parentCategory || !subparentCategory || !subSubName || !subSubIcon || !subSubStatus || !subSubDesc) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (!['active', 'inactive'].includes(subSubStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        if (subSubName.length < 3 || subSubName.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory name must be between 3 and 60 characters"
            });
        }

        if (subSubIcon.length < 3 || subSubIcon.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory icon must be between 3 and 60 characters"
            });
        }

        if (subSubDesc.length < 3 || subSubDesc.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Sub-subcategory description must be between 3 and 500 characters"
            });
        }

        if (req.file && !req.file.mimetype.startsWith("image/")) {
            return res.status(400).json({
                success: false,
                message: "Uploaded file must be an image"
            });
        }

        if (req.file && req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: "Image size must be less than 5MB"
            });
        }

        const updateData = { parentCategory, subparentCategory, subSubName, subSubIcon, subSubStatus, subSubDesc };

        // Handle image update
        if (req.file) {
            updateData.sub_subcategoryImages = {
                filename: req.file.filename,
                path: `/Uploads/sub_subcategory/${req.file.filename}`,
                size: req.file.size,
                mimetype: req.file.mimetype
            };
        }

        // Update + return updated doc
        const updatedSubSubCategory = await sub_subCategory.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedSubSubCategory) {
            return res.status(404).json({
                success: false,
                message: "Sub-subcategory not found"
            });
        }

        // Populate after update (ONLY ONCE, CLEAN)
        const populatedSubSubCategory = await sub_subCategory
            .findById(updatedSubSubCategory._id)
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName');

        console.log('Sub-subcategory updated:', updatedSubSubCategory._id);

        return res.status(200).json({
            success: true,
            message: "Sub-subcategory updated successfully",
            data: populatedSubSubCategory
        });

    } catch (error) {
        console.error("UPDATE sub_subcategory error:", error);
        next(error);
    }
});

// ADMIN SUB_SUBCATEGORY PAGE AND DELETED 
router.delete('/deletesub_subcategoryForm/:id', isAuthenticated , async (req, res, next) => {
    try {

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID is required"
            });
        }

        const deletedSubSubCategory = await sub_subCategory.findByIdAndDelete(id);

        if (!deletedSubSubCategory) {
            return res.status(404).json({
                success: false,
                message: "Sub-subcategory not found"
            });
        }

        console.log("Deleted sub-subcategory:", deletedSubSubCategory._id);

        return res.status(200).json({
            success: true,
            message: "Sub-subcategory deleted successfully",
            data: deletedSubSubCategory
        });

    } catch (error) {
        console.error("DELETE sub_subcategory error:", error);
        next(error);
    }
});

// ADIMIN - ALL CATEGORY
router.get('/allCategory', isAuthenticated , async (req, res, next) => {
    try {
        const categories = await Category.find()
            .sort({ categoryName: 1 }).lean();

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
router.get('/allsubCategory', isAuthenticated , async (req, res, next) => {
    try {
        const subcategories = await subCategory
            .find()
            .sort({ subcategoryName: 1 })
            .populate('parentCategory', 'categoryName').lean();

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
router.get('/allsub_subCategory', isAuthenticated , async (req, res, next) => {
    try {
        const sub_subcategories = await sub_subCategory
            .find()
            .sort({ subSubName: 1 })
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName')
            .lean();

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

router.get('/all-category-system', async (req, res, next) => {
    try {

        // --------------------
        // 1. CATEGORIES
        // --------------------
        const categories = await Category.find({ status: 'active' })
            .sort({ categoryName: 1 })
            .lean();

        const transformedCategories = categories.map(cat => ({
            id: cat._id,
            name: cat.categoryName,
            icon: cat.icon || null,
        }));


        // --------------------
        // 2. SUBCATEGORIES
        // --------------------
        const subcategories = await subCategory.find({ status: 'active' })
            .sort({ subcategoryName: 1 })
            .populate('parentCategory', 'categoryName')
            .lean();

        const transformedSubcategories = subcategories.map(item => ({
            id: item._id,
            parentId: item.parentCategory?._id || null,
            parentName: item.parentCategory?.categoryName || null,
            name: item.subcategoryName,
            icon: item.icon || null,
        }));


        // --------------------
        // 3. SUB-SUBCATEGORIES
        // --------------------
        const subSubcategories = await sub_subCategory.find({ subSubStatus: 'active' })
            .sort({ subSubName: 1 })
            .populate('parentCategory', 'categoryName')
            .populate('subparentCategory', 'subcategoryName')
            .lean();

        const transformedSubSubcategories = subSubcategories.map(item => ({
            id: item._id,
            parentId: item.parentCategory?._id || null,
            parentName: item.parentCategory?.categoryName || null,
            subParentId: item.subparentCategory?._id || null,
            subParentName: item.subparentCategory?.subcategoryName || null,
            name: item.subSubName,
            icon: item.subSubIcon || null,
        }));


        // --------------------
        // FINAL RESPONSE
        // --------------------
        return res.status(200).json({
            success: true,
            message: "Full category system fetched successfully",
            data: {
                categories: transformedCategories,
                subcategories: transformedSubcategories,
                subSubcategories: transformedSubSubcategories
            }
        });

    } catch (error) {
        console.error("GET /all-category-system error:", error);
        next(error);
    }
});

// ADMIN ODER PAGE
router.get('/order', isAuthenticated , async (req, res, next) => {

    try {

        res.render('../Views/Admin/orders');

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

// ADMIN GET ALL ORDER
router.get('/orders', isAuthenticated , async (req, res) => {
    try {

        const orders = await Order.find()
            .populate({
                path: 'items.productId',
                select: 'productName mainImage brand model'
            })
            .populate({
                path: "userId",
                select: "email"
            })
            .sort({ createdAt: -1 })
            .lean();

        const formattedOrders = orders.map(order => {

            // fix floating point issue
            const subtotal = Number(order.totals?.subtotal ?? 0);
            const tax = Number(order.totals?.tax ?? 0);
            const shippingFee = Number(order.totals?.shippingFee ?? 0);

            return {
                orderId: order._id,
                userId: order.userId || { email: null },
                orderStatus: order.orderStatus,
                returnStatus: order.returnStatus || 'none',
                refundStatus: order.returnStatus || 'none',
                orderTimeline: order.timeline || {},
                returnTimeline: order.returnTimeline || {},
                refundTimeline: order.refundTimeline || {},

                totals: {
                    subtotal: Number(subtotal.toFixed(2)),
                    tax: Number(tax.toFixed(2)),
                    shippingFee: Number(shippingFee.toFixed(2)),
                    totalAmount: Number((subtotal + tax + shippingFee).toFixed(2))
                },

                items: (order.items || []).map(item => ({
                    productId: item.productId || null,
                    productName: item.productId?.productName || null,
                    quantity: item.quantity ?? 0,
                }))
            };
        });

        return res.status(200).json({
            success: true,
            orderCount: formattedOrders.length,
            orderData: formattedOrders
        });

    } catch (error) {
        console.error("Order fetch error:", error);

        return res.status(500).json({
            success: false,
            message: "Order page server error"
        });
    }
});

// ADMIN GET SINGLE ORDER DETAILS EJS
router.get('/orderDetails/:id', isAuthenticated , async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        };
        return res.render('../Views/Admin/orderDetails', {
            order
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// SINGLE ORDER DETAILS 
router.get('/order/:id', isAuthenticated , async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id)
            .populate({
                path: 'items.productId',
                select: 'productName price comparePrice mainImage stockQuantity brand model'
            })
            .populate({
                path: 'userId', select: 'email'
            })
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// UPDATE ORDER STATUS
router.put("/order/status/:id", isAuthenticated , async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Order ID"
            });
        }

        const validStatus = [
            "pending",
            "confirmed",
            "processing",
            "packed",
            "shipped",
            "out_for_delivery",
            "delivered",
            "delivery_failed",
            "delivery_completed",
            "cancelled",
            "returned"
        ];

        if (!validStatus.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Order Status"
            });
        }

        const order = await Order.findById(id).populate({
            path: "userId",
            select: "email name"
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const statusFlow = {
            pending: ["confirmed", "cancelled"],
            confirmed: ["processing", "cancelled"],
            processing: ["packed", "cancelled"],
            packed: ["shipped", "cancelled"],
            shipped: ["out_for_delivery", "delivered"],
            out_for_delivery: ["delivered", "delivery_failed"],
            delivered: ["delivery_completed", "returned"],
            delivery_failed: ["out_for_delivery", "returned"],
            delivery_completed: [],
            cancelled: [],
            returned: []
        };

        const currentStatus = order.orderStatus;
        const allowedNext = statusFlow[currentStatus] || [];

        if (!allowedNext.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change status from ${currentStatus} to ${orderStatus}`
            });
        }

        const now = new Date();

        if (!order.orderTimeline) {
            order.orderTimeline = {};
        }

        order.orderTimeline[`${orderStatus}At`] = now;
        order.orderStatus = orderStatus;

        // =========================
        // OTP EMAIL ON DELIVERY
        // =========================

        if (orderStatus === "delivered") {

            const otp = crypto.randomInt(1000, 9999).toString();
            const hashedOtp = await bcrypt.hash(otp, 10);

            order.deliveryOtp = hashedOtp;
            order.deliveryOtpExpire = Date.now() + 1 * 24 * 60 * 60 * 1000;

            if (!order.userId?.email) {
                return res.status(400).json({
                    success: false,
                    message: "Customer email not found"
                });
            }

            const emailSent = await sendOTPEmail(
                order.userId.email,
                otp,
                'delivery'   // 👈 uses the new delivery config
            );

            if (!emailSent) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to send OTP email"
                });
            }

        }

        // =========================

        if (orderStatus === "delivery_completed") {
            order.paymentStatus = "paid";
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            order
        });

    } catch (error) {
        console.error("Update Order Status Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
});

// UPDATE PAYMENT STATUS
router.put('/payment/status/:id', isAuthenticated , async (req, res) => {
    try {

        const { id } = req.params;
        const { paymentStatus } = req.body;

        // =====================
        // VALIDATION
        // =====================

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Order ID'
            });
        }

        const validStatus = ['pending', 'paid', 'failed', 'refunded'];

        if (!validStatus.includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Payment Status'
            });
        }

        // =====================
        // FIND ORDER
        // =====================

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const now = new Date();

        // =====================
        // UPDATE PAYMENT TIMELINE
        // =====================

        switch (paymentStatus) {

            case 'pending':
                order.paymentTimeline.pendingAt = now;
                break;

            case 'paid':
                order.paymentTimeline.paidAt = now;
                break;

            case 'failed':
                order.paymentTimeline.failedAt = now;
                break;

            case 'refunded':
                order.paymentTimeline.refundedAt = now;
                break;
        }

        // =====================
        // UPDATE STATUS
        // =====================

        order.paymentStatus = paymentStatus;

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Payment status updated successfully',
            order
        });

    } catch (error) {
        console.error('Update Payment Status Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// UPDATE RETUEN STATUS
router.put('/return/status/:id', isAuthenticated , async (req, res) => {
    try {

        const { id } = req.params;
        const { returnStatus } = req.body;

        // =====================
        // VALIDATION
        // =====================

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Order ID'
            });
        }

        const validStatus = [
            'requested',
            'approved',
            'rejected',
            'completed',
        ];

        if (!validStatus.includes(returnStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Return Status'
            });
        }

        // =====================
        // FIND ORDER
        // =====================

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        const now = new Date();

        // =====================
        // UPDATE RETURN TIMELINE
        // =====================

        switch (returnStatus) {

            case 'approved':
                order.returnTimeline.returnApprovedAt = now;
                break;

            case 'rejected':
                order.returnTimeline.returnRejectedAt = now;
                break;

            case 'completed':
                order.returnTimeline.returnCompletedAt = now;
                break;

            case 'none':
                order.returnTimeline.returnApprovedAt = null;
                order.returnTimeline.returnRejectedAt = null;
                order.returnTimeline.returnCompletedAt = null;
                break;
        }

        // =====================
        // UPDATE STATUS
        // =====================

        order.returnStatus = returnStatus;

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Return status updated successfully',
            order
        });

    } catch (error) {

        console.error('Update Return Status Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// ADMIN APPROVE RETURN REQUEST
router.put('/order/return-approve/:id', isAuthenticated , async (req, res) => {
    try {

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.returnStatus !== 'requested') {
            return res.status(400).json({
                success: false,
                message: "No return request found"
            });
        }

        // Invalid order status check
        const invalidReturnStatuses = [
            'pending',
            'confirmed',
            'processing',
            'packed',
            'shipped',
            'out_for_delivery'
        ];

        if (invalidReturnStatuses.includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be returned. Current status: ${order.orderStatus}`
            });
        }

        // APPROVE
        order.returnStatus = 'approved';
        order.orderStatus = 'returned';
        order.paymentStatus = "refunded"
        order.returnTimeline.returnApprovedAt = new Date();

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Return approved successfully",
            order
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// ADMIN - COMPLETE RETURN (product received back)
router.put('/order/return-complete/:id', isAuthenticated , async (req, res) => {
    try {

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.returnStatus !== 'approved') {
            return res.status(400).json({
                success: false,
                message: "Return is not approved"
            });
        }

        if (!order.returnTimeline?.returnApprovedAt) {
            return res.status(400).json({
                success: false,
                message: "Return approval date missing"
            });
        }

        // Ensure correct state
        if (order.orderStatus !== 'returned') {
            return res.status(400).json({
                success: false,
                message: `Invalid order state: ${order.orderStatus}`
            });
        }

        // =========================
        // COMPLETE RETURN ONLY
        // =========================
        order.returnStatus = 'completed';
        order.returnTimeline.returnCompletedAt = new Date();

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Return completed successfully",
            data: order
        });

    } catch (error) {
        console.error("Return Complete Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// ADMIN REJECT RETURN REQUEST
router.put('/order/return-reject/:id', isAuthenticated , async (req, res) => {
    try {
        const { returnrejectReason, returnrejectComment } = req.body;

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Check if return request exists
        if (order.returnStatus !== 'requested') {
            return res.status(400).json({
                success: false,
                message: "No return request found"
            });
        }

        // Validate rejection reason
        if (!returnrejectReason || returnrejectReason.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required"
            });
        }

        // Prevent return actions for invalid order statuses
        const invalidReturnStatuses = [
            'pending',
            'confirmed',
            'processing',
            'packed',
            'shipped',
            'out_for_delivery',
            'cancelled'
        ];

        if (invalidReturnStatuses.includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be updated for return. Current status: ${order.orderStatus}`
            });
        }

        // Update order return details
        order.returnStatus = 'rejected';
        order.orderStatus = 'delivery_completed';

        order.returnTimeline = order.returnTimeline || {};
        order.returnTimeline.returnRejectedAt = new Date();

        order.returnrejectReason = returnrejectReason;
        order.returnrejectComment = returnrejectComment || "";

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Return request rejected successfully",
            order
        });

    } catch (error) {
        console.error("Return reject error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// ADMIN CUSTOMER PAGE
router.get('/customer', isAuthenticated , async (req, res, next) => {

    try {

        res.render('../Views/Admin/customer');

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

// ADMIN CUSTOMER PAGE POST
router.get('/customers', isAuthenticated , async (req, res) => {
    try {

        const customers = await Signup.find().lean();

        if (!customers || customers.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No customers found',
                customers: []
            });
        }

        const customerData = await Promise.all(
            customers.map(async (customer) => {

                // 🔥 OPTIMIZED ORDER FETCH
                const orders = await Order.find({
                    userId: customer._id
                })
                    .select("totals.totalAmount")
                    .lean();

                // 🔥 FIXED PATH (IMPORTANT)
                const totalOrdersAmount = orders.reduce(
                    (sum, order) => sum + (order.totals?.totalAmount || 0),
                    0
                );

                return {
                    _id: customer._id,
                    name: customer.fullName || null,
                    email: customer.email,
                    image: customer.profileImage || null,
                    isVerified: customer.isVerified || false,
                    phone: customer.phone || null,

                    // NOTE: shippingAddress is NOT in user model usually
                    address: customer.address || null,

                    joinedAt: customer.createdAt
                        ? customer.createdAt.toISOString().split('T')[0]
                        : null,

                    isBlocked: customer.isBlocked || false,

                    totalOrdersAmount,
                    orderCount: orders.length
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Customer information fetched successfully',
            customers: customerData,
            customerCount: customerData.length
        });

    } catch (error) {

        console.error('Error fetching customers:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// BLOCK CUSTOMER
router.put('/customer/block/:id', isAuthenticated , async (req, res) => {
    try {

        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Customer ID'
            });
        }

        // Find Customer
        const user = await Signup.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Block Customer
        user.isBlocked = true;

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Customer account blocked successfully',
            user: user.isBlocked
        });

    } catch (error) {
        console.error('Block Customer Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// UNBLOCK CUSTOMER
router.put('/customer/unblock/:id', isAuthenticated , async (req, res) => {
    try {

        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Customer ID'
            });
        }

        // Find Customer
        const user = await Signup.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Unblock Customer
        user.isBlocked = false;

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Customer account unblocked successfully',
            user: user.isBlocked
        });

    } catch (error) {
        console.error('Unblock Customer Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// SINGLE CUSTOMER DETAILS PAGE OF EJS
router.get('/customerDetails/:id', isAuthenticated , async (req, res, next) => {
    try {

        const { id } = req.params;

        const user = await Signup.findById(id).lean();

        if (!user) {
            return res.status(404).send("Customer not found");
        }

        return res.render('Admin/customersDetails', {
            user
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send("Server Error");
    }
});

// SINGLE CUSTOMER DETAILS
router.get('/customer/:id', isAuthenticated , async (req, res) => {
    try {

        const { id } = req.params;

        const customer = await Signup.findById(id).lean();

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const orders = await Order.find({
            userId: customer._id
        })
            .populate({
                path: "items.productId",
                select: "productName mainImage brand model price"
            })
            .select("totals createdAt items orderStatus paymentStatus")
            .sort({ createdAt: -1 })
            .lean();

        // 🔥 SAFE TOTAL CALCULATION
        const totalOrdersAmount = orders.reduce(
            (sum, order) => sum + (order.totals?.totalAmount || 0),
            0
        );

        const customerData = {
            _id: customer._id,
            name: customer.fullName || null,
            email: customer.email,
            image: customer.profileImage || null,
            isVerified: customer.isVerified || false,
            phone: customer.phone || null,
            address: customer.address || null,

            joinedAt: customer.createdAt
                ? customer.createdAt.toISOString().split('T')[0]
                : null,

            totalOrdersAmount,
            orderCount: orders.length
        };

        return res.status(200).json({
            success: true,
            message: 'Customer information fetched successfully',
            customer: customerData,
            orders   // ✅ FIXED (was "product")
        });

    } catch (error) {

        console.error('Error fetching customer:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ADMIN ANALYTICS PAGE
router.get('/analytics', isAuthenticated , async (req, res, next) => {

    try {

        res.render('../Views/Admin/analytics');

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

// ADMIN SETTING PAGE
router.get('/setting', async (req, res, next) => {

    try {

        res.render('../Views/Admin/setting');

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

// REVIEWS PAGE OF EJS
router.get('/review', isAuthenticated , async (req, res, next) => {
    try {
        res.render('../Views/Admin/reviews');
    } catch (error) {
        console.error("Get Reviews Page Error:", error);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

// REVIEWS
router.get('/reviews', isAuthenticated , async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate({
                path: 'userId',
                select: 'fullName email'
            })
            .populate({
                path: 'reviewItems.productId',
                select: 'productName mainImage brand model price'
            });

        return res.status(200).json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error("Get Reviews Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
});

// REVIEW DETAILS
router.get('/review/:id', isAuthenticated , async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id)
            .populate({
                path: 'userId',
                select: 'fullName email'
            })
            .populate({
                path: 'reviewItems.productId',
                select: 'productName mainImage brand model price'
            });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: "Review not found"
            });
        }

        return res.status(200).json({
            success: true,
            review
        });
    } catch (error) {
        console.error("Get Review Details Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
});

// REVIEW RATING COUNT
router.get('/reviews/ratings/count', isAuthenticated , async (req, res) => {
    try {
        const ratingCounts = await Review.aggregate([
            { $unwind: "$reviewItems" },
            {
                $group: {
                    _id: "$reviewItems.rating",
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const formattedCounts = ratingCounts.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }
            , {});

        return res.status(200).json({
            success: true,
            ratingCounts: formattedCounts
        });
    } catch (error) {
        console.error("Get Rating Counts Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
});

// Order by revenue 
router.get('/orders/revenue', isAuthenticated , async (req, res) => {
    try {
        const revenueData = await Order.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    totalRevenue: { $sum: "$totals.totalAmount" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
        ]);
        return res.status(200).json({
            success: true,
            revenueData
        });
    } catch (error) {
        console.error("Get Revenue Data Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Server Error"
        });
    }
});

// cutomer count by month and year and day and week and block status and unblock status count
router.get('/customers/blocks', isAuthenticated , async (req, res) => {
    try {
        const [blocked, unblocked] = await Promise.all([
            Signup.countDocuments({ isBlocked: true }),
            Signup.countDocuments({ isBlocked: false })
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalCustomers: blocked + unblocked,
                blocked,
                unblocked
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/customers/count', isAuthenticated , async (req, res) => {
    try {
        const [yearly, monthly, weekly, daily] = await Promise.all([
            // Yearly
            Signup.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            isBlocked: "$isBlocked"
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1 } }
            ]),

            // Monthly
            Signup.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            isBlocked: "$isBlocked"
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),

            // Weekly
            Signup.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $isoWeekYear: "$createdAt" },
                            week: { $isoWeek: "$createdAt" },
                            isBlocked: "$isBlocked"
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: {
                        "_id.year": 1,
                        "_id.week": 1
                    }
                }
            ]),

            // Daily
            Signup.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" },
                            isBlocked: "$isBlocked"
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: {
                        "_id.year": 1,
                        "_id.month": 1,
                        "_id.day": 1
                    }
                }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: {
                yearly,
                monthly,
                weekly,
                daily
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;