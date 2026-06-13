const express = require('express');
const { Product } = require('../../Model/Admin/productModel');
const { Signup } = require('../../Model/User/userAuther');
const Cart = require('../../Model/User/cart');
const Wishlist = require('../../Model/User/wishlistModel');
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
// Check Auth Route
router.get("/api/check-auth", async (req, res) => {
    try {

        const loggedIn = !!(req.session?.userId && req.session?.isLoggedIn);

        if (!loggedIn) {
            return res.json({
                loggedIn: false,
                data: null
            });
        }
        const user = await Signup.findById(req.session.userId);

        // ❌ BLOCK CHECK
        if (!user || user.isBlocked) {
            req.session.destroy(() => {});

            return res.json({
                loggedIn: false,
                blocked: true,
                message: "Account blocked"
            });
        }

        return res.json({
            loggedIn: true,
            message: "User authenticated",
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            loggedIn: false,
            message: "Server Error"
        });
    }
});

// Logout Route
router.get("/logout", async (req, res) => {
    try {

        // Optional: check user before destroying session
        if (req.session?.userId) {
            const user = await Signup.findById(req.session.userId);

            if (user && user.isBlocked) {
                console.log("Blocked user logging out");
            }
        }

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Logout failed"
                });
            }

            res.clearCookie("connect.sid");

            return res.json({
                success: true,
                message: "Logged out"
            });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

// GET Cart page
router.get('/cart', isAuthenticated, async (req, res, next) => {
    try {
        return res.render('Products/cart');
    } catch (error) {
        console.error("CART route error:", error);
        return next(error);
    }
});

// GET Carts 
router.get('/carts', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'productName price comparePrice mainImage stockQuantity brand model dimensions.shippingCost'
            });

        if (!cart || !cart.items.length) {
            return res.status(200).json({
                success: true,
                message: "Cart is empty",
                count: 0,
                data: []
            });
        }

        let cartModified = false;

        cart.items = cart.items.filter(item => {
            const product = item.productId;

            // Product deleted
            if (!product) {
                cartModified = true;
                return false;
            }

            // Quantity <= 0
            if (item.quantity <= 0) {
                cartModified = true;
                return false;
            }

            // Out of stock
            if (product.stockQuantity <= 0) {
                cartModified = true;
                return false;
            }

            // Max quantity = 10
            if (item.quantity > 10) {
                item.quantity = 10;
                cartModified = true;
            }

            // Quantity exceeds stock
            if (item.quantity > product.stockQuantity) {
                item.quantity = product.stockQuantity;
                cartModified = true;
            }

            return true;
        });

        if (cartModified) {
            await cart.save();
        }

        const formattedItems = cart.items.map(item => {
            const product = item.productId;

            return {
                productId: product._id,
                name: product.productName,
                price: product.price,
                comparePrice: product.comparePrice,
                image: product.mainImage,
                stockQuantity: product.stockQuantity,
                brand: product.brand,
                model: product.model,
                shippingCost: product.dimensions?.shippingCost || 0,
                quantity: item.quantity,
                total: product.price * item.quantity
            };
        });

        return res.status(200).json({
            success: true,
            message: "Cart fetched successfully",
            count: formattedItems.length,
            data: formattedItems
        });

    } catch (error) {
        console.error("CART FETCH ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cart",
            error: error.message
        });
    }
});

// POST Add to Cart
router.post('/cart', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { productId, quantity } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const stockQuantity = Number(product.stockQuantity) || 0;
        let qty = Number(quantity);

        // Default quantity
        if (Number.isNaN(qty)) {
            qty = 1;
        }

        // Remove item if qty <= 0
        if (qty <= 0) {
            const cart = await Cart.findOneAndUpdate(
                { userId },
                {
                    $pull: {
                        items: { productId }
                    }
                },
                { new: true }
            );

            return res.status(200).json({
                success: true,
                message: "Item removed from cart",
                data: cart
            });
        }

        // Max quantity
        if (qty > 10) {
            qty = 10;
        }

        // Out of stock
        if (stockQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Product is out of stock"
            });
        }

        // Requested quantity exceeds stock
        if (qty > stockQuantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${stockQuantity} item(s) available`
            });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = await Cart.create({
                userId,
                items: [{
                    productId,
                    quantity: qty,
                    stockQuantity
                }]
            });
        } else {
            const itemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );

            if (itemIndex > -1) {
                cart.items[itemIndex].quantity = qty;
                cart.items[itemIndex].stockQuantity = stockQuantity;
            } else {
                cart.items.push({
                    productId,
                    quantity: qty,
                    stockQuantity
                });
            }

            await cart.save();
        }

        return res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            data: cart
        });

    } catch (error) {
        console.error("CART ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process cart request",
            error: error.message
        });
    }
});

// PUT Update Cart Item
router.put('/cart', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        const { productId, quantity } = req.body;

        if (!productId || quantity === undefined) {
            return res.status(400).json({
                success: false,
                message: "productId and quantity are required"
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        let qty = Number(quantity);

        if (Number.isNaN(qty)) {
            return res.status(400).json({
                success: false,
                message: "Invalid quantity"
            });
        }

        // Remove from cart
        if (qty <= 0) {
            const cart = await Cart.findOneAndUpdate(
                { userId },
                {
                    $pull: {
                        items: { productId }
                    }
                },
                { new: true }
            );

            return res.status(200).json({
                success: true,
                message: "Item removed from cart",
                data: cart
            });
        }

        // Maximum quantity allowed
        if (qty > 10) {
            qty = 10;
        }

        // Out of stock
        if (product.stockQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Product is out of stock"
            });
        }

        // Requested quantity exceeds stock
        if (qty > product.stockQuantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stockQuantity} item(s) available`
            });
        }

        const cart = await Cart.findOneAndUpdate(
            {
                userId,
                "items.productId": productId
            },
            {
                $set: {
                    "items.$.quantity": qty,
                    "items.$.stockQuantity": product.stockQuantity
                }
            },
            {
                new: true
            }
        );

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Product not found in cart"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            data: cart
        });

    } catch (error) {
        console.error("UPDATE CART ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update cart",
            error: error.message
        });
    }
});

// DELETE Single Cart Item
router.delete('/cart/:productId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        // =========================
        // SESSION CHECK
        // =========================
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }

        // =========================
        // CHECK PRODUCT EXISTS
        // =========================
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // =========================
        // REMOVE ITEM FROM CART
        // =========================
        const cart = await Cart.findOneAndUpdate(
            { userId },
            {
                $pull: {
                    items: { productId: productId }
                }
            },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item removed from cart successfully",
            data: cart
        });

    } catch (error) {
        console.error("DELETE CART ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete cart item",
            error: error.message
        });
    }
});

// DELETE Clear Cart
router.delete('/cart', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        const cart = await Cart.findOneAndUpdate(
            { userId },
            {
                $set: {
                    items: []
                }
            },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cart cleared successfully",
            data: cart
        });

    } catch (error) {
        console.error("CLEAR CART ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to clear cart",
            error: error.message
        });
    }
});


// GET Wishlist page
router.get('/wishlist', isAuthenticated, async (req, res, next) => {
    try {
        return res.render('Products/wishlist');
    } catch (error) {
        console.error("WISHLIST route error:", error);
        return next(error);
    }
});

// GET WISHLIST
router.get('/wishlists', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        // Check user
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Find user's wishlist
        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'name price comparePrice mainImage stockQuantity'
            })
            .lean();

        // Empty wishlist
        if (!wishlist || wishlist.items.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Wishlist is empty',
                count: 0,
                data: []
            });
        }

        // Format response
        const formattedItems = wishlist.items.map(item => {
            const product = item.productId;

            return {
                productId: product._id,
                name: product.name,
                price: product.price,
                comparePrice: product.comparePrice,
                image: product.mainImage,
                stockQuantity: product.stockQuantity
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Wishlist fetched successfully',
            count: formattedItems.length,
            data: formattedItems
        });

    } catch (error) {
        console.error('WISHLIST FETCH ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch wishlist',
            // error: error.message
        });
    }
});

// ADD TO WISHLIST
router.post('/wishlist', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        // Check user
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }

        // Check product
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Find existing wishlist
        let wishlist = await Wishlist.findOne({ userId });

        // Create wishlist if not exists
        if (!wishlist) {
            wishlist = await Wishlist.create({
                userId,
                items: [{
                    productId
                }]
            });

        } else {

            // Check if product already exists
            const existingItem = wishlist.items.find(
                item => item.productId.toString() === productId.toString()
            );

            if (existingItem) {
                return res.status(400).json({
                    success: false,
                    message: "Product already in wishlist"
                });
            }

            // Add new product
            wishlist.items.push({
                productId
            });

            await wishlist.save();
        }

        return res.status(200).json({
            success: true,
            message: "Product added to wishlist successfully",
            data: wishlist
        });

    } catch (error) {
        console.error("WISHLIST ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process wishlist request",
            error: error.message
        });
    }
});

// Single Wishlist Remove
router.delete('/wishlist', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        // Check user
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "productId is required"
            });
        }

        // Check product
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: "Wishlist not found"
            });
        }

        const initialLength = wishlist.items.length;

        // Remove item
        wishlist.items = wishlist.items.filter(
            item => item.productId.toString() !== productId.toString()
        );

        if (wishlist.items.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: "Product not found in wishlist"
            });
        }

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: "Product removed from wishlist successfully",
            data: wishlist
        });

    } catch (error) {
        console.error("WISHLIST DELETE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove wishlist item",
            error: error.message
        });
    }
});

// Remove All Wishlist
router.delete('/wishlist/clear', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not logged in or session expired"
            });
        }

        // Check user
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: "Wishlist not found"
            });
        }

        // Clear all items
        wishlist.items = [];

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: "Wishlist cleared successfully",
            data: wishlist
        });

    } catch (error) {
        console.error("WISHLIST CLEAR ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to clear wishlist",
            error: error.message
        });
    }
});

module.exports = router;