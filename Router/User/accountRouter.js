const express = require('express');
const Cart = require('../../Model/User/cart');
const { Signup } = require('../../Model/User/userAuther');
const { Product } = require('../../Model/Admin/productModel');
const upload = require('../../Multer/multer');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    try {

        // Check session
        if (req.session && req.session.userId && req.session.isLoggedIn) {

            // ❌ BLOCKED USER CHECK
            if (req.session.isBlocked) {
                req.session.destroy(() => {
                    return res.redirect('/login');
                });
                return;
            }

            return next();
        }

        // Save requested page
        req.session.returnTo = req.originalUrl;

        // Redirect to login
        return res.redirect('/login');

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

// GET /account - User account page
router.get('/account', isAuthenticated, async (req, res, next) => {
    try {
        return res.render('user/account', {
            title: 'My Account',
            user: { name: req.session.userName, email: req.session.userEmail }
        });
    } catch (error) {
        console.error("ACCOUNT route error:", error);
        return next(error);
    }
});

// GET /profile - Get user profile data
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        return res.render('user/profile', {
            title: 'My Profile',
            user: { name: req.session.userName, email: req.session.userEmail }
        });
    } catch (error) {
        console.error("PROFILE route error:", error);
        return res.status(500).send('Internal Server Error');
    }
});

// GET SIGNUP DATA FETCH PROFILE PAGE
router.get('/profiles', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userProfile = await Signup.findById(userId).select('fullName email phone address profileImage createdAt');

        if (!userProfile) {
            return res.status(404).json({ success: false, message: 'User profile not found' });
        }

        return res.status(200).json({ success: true, data: userProfile });

    } catch (error) {
        console.error("PROFILES route error:", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// UPDATE PROFILE
router.put('/profile', isAuthenticated, upload.single('profileImage'), async (req, res) => {

    try {

        const userId = req.session.userId;
        const { fullName, phone, address } = req.body;

        // validation
        if (!fullName || !phone || !address) {
            return res.status(400).json({
                success: false,
                message: 'Full name, phone, and address are required'
            });
        }

        const profileData = { fullName, phone, address };

        // handle file properly
        if (req.file) {
            profileData.profileImage = {
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size
            };
        }

        if (fullName.length < 2 || fullName.length > 50) {
            return res.status(400).json({ success: false, message: 'Full name must be between 2 and 50 characters' });
        }

        const phoneRegex = /^[0-9+\-\s]*$/;
        if (!phoneRegex.test(phone) || phone.length < 10 || phone.length > 15) {
            return res.status(400).json({ success: false, message: 'Invalid phone number' });
        }

        if (address.length > 200) {
            return res.status(400).json({ success: false, message: 'Address cannot exceed 200 characters' });
        }

        const updatedProfile = await Signup.findByIdAndUpdate(
            userId,
            profileData,
            { new: true, runValidators: true }
        ).select('fullName email phone address profileImage createdAt');

        return res.json({
            success: true,
            data: updatedProfile
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

// CHECKOUT PAGE
router.get('/checkout', isAuthenticated, async (req, res) => {
    try {
        return res.render('user/checkout', {
            title: 'Checkout',
            user: { name: req.session.userName, email: req.session.userEmail }
        });
    } catch (error) {
        console.error("CHECKOUT route error:", error);
        return res.status(500).send('Internal Server Error');
    }
});

// CHECKOUT DATA FETCH IN CART
router.get('/checkout-data', isAuthenticated, async (req, res) => {
    try {

        const userId = req.session.userId;

        // Validate session user
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized access'
            });
        }

        // Fetch user profile
        const userProfile = await Signup.findById(userId)
            .select('fullName email phone address');

        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        // Fetch cart
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: `
                    productName
                    price
                    comparePrice
                    mainImage
                    stockQuantity
                    brand
                    model
                    dimensions.shippingCost
                    deliveryTimeline.minTime
                    deliveryTimeline.maxTime
                `
            });

        // Cart validation
        if (!cart || !cart.items.length) {
            return res.status(404).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                userProfile,
                products: cart.items
            }
        });

    } catch (error) {

        console.error('CHECKOUT-DATA route error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});
// CHECKOUT SINGLE PRODUCT cart single product data fetch
router.get('/checkout-data/:productId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { productId } = req.params;

        // User profile
        const userProfile = await Signup.findById(userId)
            .select('fullName email phone address');

        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found'
            });
        }

        // Cart
        const cart = await Cart.findOne({ userId })
            .populate('items.productId', 'productName price comparePrice mainImage stockQuantity brand model dimensions.shippingCost deliveryTimeline.minTime deliveryTimeline.maxTime');

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Find single product
        const product = cart.items.find(
            item => item.productId._id.toString() === productId
        );


        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                userProfile,
                product
            }
        });

    } catch (error) {
        console.error('CHECKOUT-DATA route error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

module.exports = router;