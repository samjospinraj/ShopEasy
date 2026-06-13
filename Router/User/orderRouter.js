const express = require('express');
const Cart = require('../../Model/User/cart');
const { Signup } = require('../../Model/User/userAuther');
const Order = require('../../Model/User/orderModel');
const { Product } = require('../../Model/Admin/productModel');
const Review = require('../../Model/User/reviewModel');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const upload = require('../../Multer/multer');
const bcrypt = require('bcrypt');
const router = express.Router();
const crypto = require('crypto');

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

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Cash On Delivery ORDER
router.post("/cash-on-delivery", isAuthenticated, async (req, res) => {
    try {

        const { fullName, phone, address, city, postalCode, state, country, items } = req.body;

        const userId = req.session.userId;

        // USER CHECK
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // BASIC VALIDATION
        if (!fullName || !phone || !address || !city || !postalCode || !state || !country || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (fullName.trim().length < 3 || fullName.trim().length > 50) {
            return res.status(400).json({ message: "Invalid full name" });
        }

        if (!/^[0-9]{10,15}$/.test(phone)) {
            return res.status(400).json({ message: "Invalid phone number" });
        }

        if (address.trim().length < 5 || address.trim().length > 200) {
            return res.status(400).json({ message: "Invalid address" });
        }

        if (country.toLowerCase() !== "india") {
            return res.status(400).json({
                success: false,
                message: "Only India orders allowed",
            });
        }

        // PRODUCT IDS
        const productIds = items.map(i => i.productId);

        const products = await Product.find({
            _id: { $in: productIds }
        }).lean();

        if (products.length !== items.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid products in cart",
            });
        }

        // MAP ITEMS SAFELY
        const orderItems = items.map(item => {
            const product = products.find(
                p => p._id.toString() === String(item.productId)
            );

            if (!product) {
                throw new Error("Product not found");
            }

            return {
                productId: product._id,
                quantity: item.quantity,
                price: product.price,
                productName: product.productName,

                dimensions: {
                    shippingCost: product.dimensions?.shippingCost || 0,
                },

                deliveryTimeline: {
                    minTime: product.deliveryTimeline?.minTime || null,
                    maxTime: product.deliveryTimeline?.maxTime || null
                }
            };
        });



        // CALCULATE TOTAL
        const subtotal = orderItems.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0
        );

        const shippingFee = orderItems.reduce(
            (acc, item) => acc + (item.dimensions.shippingCost || 0),
            0
        );

        const tax = 0.08 * subtotal; // 8% tax

        const totalAmount = subtotal + shippingFee + tax;

        const deliveredTimeline = orderItems.reduce(
            (acc, item) => {
                const minTime = new Date(item.deliveryTimeline.minTime);
                const maxTime = new Date(item.deliveryTimeline.maxTime);

                return {
                    min:
                        !acc.min || minTime < acc.min
                            ? minTime
                            : acc.min,

                    max:
                        !acc.max || maxTime > acc.max
                            ? maxTime
                            : acc.max,
                };
            },
            { min: null, max: null }
        );

        // console.log(minTime , maxTime)

        // CREATE ORDER
        const order = new Order({
            userId,

            shippingAddress: {
                fullName: fullName.trim(),
                phone,
                address: address.trim(),
                city: city.trim(),
                postalCode: postalCode.trim(),
                state: state.trim(),
                country: country.trim(),
            },

            paymentMethod: "cashOnDelivery",
            paymentStatus: "pending",
            orderStatus: "pending",
            paymentTimeline: {
                pendingAt: new Date(),
                paidAt: null,
                failedAt: null,
                refundedAt: null,
            },

            totals: {
                subtotal,
                shippingFee,
                tax,
                totalAmount,
            },

            orderTimeline: {
                deliveredMinAt: deliveredTimeline.min,
                deliveredMaxAt: deliveredTimeline.max,
            },

            items: orderItems,
        });

        const savedOrder = await order.save();

        // REMOVE CART ITEMS
        await Cart.updateOne(
            { userId },
            {
                $pull: {
                    items: {
                        productId: { $in: productIds }
                    }
                }
            }
        );

        return res.status(201).json({
            success: true,
            message: "COD order placed successfully",
            order: savedOrder,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// // POST /create-razorpay-order
// router.post("/create-razorpay-order", isAuthenticated, async (req, res) => {
//     try {
//         const { items } = req.body;

//         // 1. Ensure user exists (already done by isAuthenticated, but we can verify)
//         const userId = req.session.userId;
//         const user = await Signup.findById(userId);
//         if (!user) {
//             return res.status(404).json({ success: false, message: "User not found." });
//         }

//         // 2. Basic items validation
//         if (!Array.isArray(items) || items.length === 0) {
//             return res.status(400).json({ success: false, message: "No items provided." });
//         }

//         // 3. Fetch all products in one query
//         const productIds = items.map(item => item.productId);
//         const products = await Product.find({ _id: { $in: productIds } });

//         if (products.length !== productIds.length) {
//             const foundIds = products.map(p => p._id.toString());
//             const missingIds = productIds.filter(id => !foundIds.includes(id));
//             return res.status(400).json({
//                 success: false,
//                 message: `Some products not found: ${missingIds.join(", ")}`,
//             });
//         }

//         // 4. Validate quantities and calculate totals
//         let subtotal = 0;
//         let shippingFee = 0;

//         items.forEach(item => {
//             const product = products.find(p => p._id.toString() === String(item.productId));
//             const price = Number(product.price) || 0;
//             const quantity = Number(item.quantity) || 1;

//             if (quantity < 1) {
//                 // We'll throw a special error to be caught below
//                 throw new Error("Quantity must be at least 1.");
//             }

//             const shipping = Number(product?.dimensions?.shippingCost) || 0;
//             subtotal += price * quantity;
//             shippingFee += shipping;
//         });

//         // 5. Calculate tax and total (8% tax as per your logic)
//         const tax = subtotal * 0.08;
//         const totalAmount = subtotal + shippingFee + tax;

//         // 6. Convert to paise (Razorpay expects integer paise)
//         const amountInPaise = Math.round(totalAmount * 100);
//         if (amountInPaise <= 0) {
//             return res.status(400).json({ success: false, message: "Total amount must be greater than zero." });
//         }

//         // 7. Create a unique receipt
//         const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

//         // 8. Create Razorpay order
//         const razorpayOrder = await razorpay.orders.create({
//             amount: amountInPaise,
//             currency: "INR",
//             receipt: receipt,
//             notes: {
//                 user_id: userId.toString(),
//                 item_count: items.length,
//             },
//         });

//         // 9. Return success with the key and order details
//         return res.status(200).json({
//             success: true,
//             key: process.env.RAZORPAY_KEY_ID,   // must be your test key in dev
//             id: razorpayOrder.id,
//             amount: razorpayOrder.amount,
//             currency: razorpayOrder.currency,
//         });

//     } catch (error) {
//         // Log the real error; send a generic message to client
//         console.error("Razorpay Order Creation Error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to create payment order. Please try again later.",
//         });
//     }
// });

// Helper to calculate order totals (reused)
const calculateTotals = (items, products) => {
    let subtotal = 0;
    let shippingFee = 0;
    const orderItems = [];

    items.forEach(item => {
        const product = products.find(p => p._id.toString() === String(item.productId));
        const price = Number(product.price) || 0;
        const quantity = Number(item.quantity) || 1;
        if (quantity < 1) throw new Error("Quantity must be at least 1.");
        const shipping = Number(product?.dimensions?.shippingCost) || 0;
        subtotal += price * quantity;
        shippingFee += shipping;
        orderItems.push({
            productId: product._id,
            quantity,
            price,
            productName: product.productName || product.name,
            shippingCost: shipping
        });
    });

    const tax = subtotal * 0.08;
    const totalAmount = subtotal + shippingFee + tax;
    return { subtotal, shippingFee, tax, totalAmount, orderItems };
};

// POST /create-razorpay-order
router.post("/create-razorpay-order", isAuthenticated, async (req, res) => {
    try {
        const { items } = req.body;

        const userId = req.session.userId;
        const user = await Signup.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "No items provided." });
        }

        const productIds = items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds } });

        if (products.length !== productIds.length) {
            const foundIds = products.map(p => p._id.toString());
            const missingIds = productIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                success: false,
                message: `Some products not found: ${missingIds.join(", ")}`
            });
        }

        // Calculate totals (throws on invalid quantity)
        let totals;
        try {
            totals = calculateTotals(items, products);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const amountInPaise = Math.round(totals.totalAmount * 100);
        if (amountInPaise <= 0) {
            return res.status(400).json({ success: false, message: "Total amount must be greater than zero." });
        }

        const receipt = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: receipt,
            notes: {
                user_id: userId.toString(),
                item_count: items.length
            }
        });

        return res.status(200).json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
        });

    } catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create payment order. Please try again later."
        });
    }
});

// POST /online-payment
router.post("/online-payment", isAuthenticated, async (req, res) => {
    try {
        const {
            fullName, phone, address, city, postalCode, state, country,
            razorpay_order_id, razorpay_payment_id, razorpay_signature,
            items
        } = req.body;

        const userId = req.session.userId;
        const user = await Signup.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        // 1. Check for duplicate payment
        const existingOrder = await Order.findOne({ "razorpay.paymentId": razorpay_payment_id });
        if (existingOrder) return res.status(400).json({ success: false, message: "Order already processed." });

        // 2. Verify Razorpay signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature." });
        }

        // 3. Fetch payment details from Razorpay (double-check status & amount)
        let payment;
        try {
            payment = await razorpay.payments.fetch(razorpay_payment_id);
        } catch (err) {
            return res.status(400).json({ success: false, message: "Payment not found or verification failed." });
        }

        if (payment.status !== "captured") {
            return res.status(400).json({ success: false, message: "Payment not captured." });
        }

        // 4. Fetch products and calculate totals
        const productIds = items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds } });
        if (products.length !== productIds.length) {
            return res.status(400).json({ success: false, message: "Some products not found." });
        }

        let totals;
        try {
            totals = calculateTotals(items, products);
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        // Optional: verify that the amount paid matches the Razorpay order amount
        const paidAmount = Number(payment.amount) / 100; // paise to rupees
        if (Math.round(totals.totalAmount * 100) !== Number(payment.amount)) {
            return res.status(400).json({ success: false, message: "Payment amount mismatch." });
        }

        // 5. Create and save the order
        const order = new Order({
            userId,
            shippingAddress: { fullName, phone, address, city, postalCode, state, country },
            paymentMethod: "onlinePayment",
            paymentStatus: "paid",
            paymentTimeline: { paidAt: new Date() },
            razorpay: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id
            },
            totals: {
                subtotal: totals.subtotal,
                shippingFee: totals.shippingFee,
                tax: totals.tax,
                totalAmount: totals.totalAmount
            },
            items: totals.orderItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                productName: item.productName,
                dimensions: { shippingCost: item.shippingCost }
            })),
            orderStatus: "confirmed",
            orderTimeline: {
                orderedAt: new Date(),
                confirmedAt: new Date()
            }
        });

        const savedOrder = await order.save();

        // 6. Remove items from cart
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId: { $in: productIds } } } }
        );

        return res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            order: savedOrder
        });

    } catch (error) {
        console.error("Online Payment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process payment. Please try again later."
        });
    }
});

// ORDER PAGE USING EJS
router.get("/myOrders", isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        const user = await Signup.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.render('../Views/User/order');
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// GET ORDERS PAGE
router.get("/orders", isAuthenticated, async (req, res) => {
    try {

        const userId = req.session.userId;

        // CHECK USER
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // FETCH ORDERS (OPTIMIZED)
        const orders = await Order.find({ userId })
            .select(
                "shippingAddress paymentMethod paymentStatus orderStatus returnStatus orderTimeline returnTimeline refundTimeline paymentStatus totals items returnReason returnrejectReason"
            )
            .populate({
                path: "items.productId",
                select: "productName brand model price mainImage "
            })
            .sort({ createdAt: -1 })
            .lean();

        // OPTIONAL: CLEAN RESPONSE FORMAT
        const formattedOrders = orders.map(order => ({
            _id: order._id,
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            returnStatus: order.returnStatus,
            returnReason: order.returnReason,
            returnrejectReason: order.returnrejectReason,
            orderTimeline: {
                orderedAt: order.orderTimeline?.orderedAt
                    ? new Date(order.orderTimeline.orderedAt).toLocaleString()
                    : null,

                deliveredMinAt: order.orderTimeline?.deliveredMinAt
                    ? new Date(order.orderTimeline.deliveredMinAt).toLocaleString()
                    : null,

                deliveredMaxAt: order.orderTimeline?.deliveredMaxAt
                    ? new Date(order.orderTimeline.deliveredMaxAt).toLocaleString()
                    : null,
            },

            returnTimeline: order.returnTimeline,
            refundTimeline: order.refundTimeline,

            totals: order.totals,

            items: order.items.map(item => ({
                productId: item.productId ? {
                    _id: item.productId._id,
                    name: item.productId.productName,
                    brand: item.productId.brand,
                    model: item.productId.model,
                    price: item.productId.price,
                    image: item.productId.mainImage,
                } : null,

                quantity: item.quantity,
                price: item.price,
                productName: item.productName
            }))
        }));

        return res.status(200).json({
            success: true,
            count: formattedOrders.length,
            orders: formattedOrders
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// GET ORDER DETAILS PAGE USING EJS
router.get("/myOrder/:orderId", isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await Signup.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const { orderId } = req.params;
        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        res.render('../Views/User/orderDetails', { order });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// GET ORDER DETAILS
router.get("/orders/:orderId", isAuthenticated, async (req, res) => {
    try {

        const userId = req.session.userId;

        // Check user
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const { orderId } = req.params;

        // FETCH SINGLE ORDER (FIXED RESPONSE)
        const order = await Order.findOne({
            _id: orderId,
            userId
        })
            .populate({
                path: "items.productId",
                select: "productName brand model price mainImage ",
            })
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        return res.status(200).json({
            success: true,
            order: order   // ✅ FIXED (single order only)
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

//CANCEL ORDER
router.put('/orders/cancel/:orderId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Check user
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const { orderId } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Order ID'
            });
        }

        // Find Order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Prevent cancelling delivered orders
        if (order.orderStatus === 'shipped' || order.orderStatus === 'delivered' || order.orderStatus === 'returned') {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled'
            });
        }

        // Prevent cancelling already cancelled orders
        if (order.orderStatus === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Order already cancelled'
            });
        }

        // Update Order Status
        order.orderStatus = 'cancelled';
        order.orderTimeline.cancelledAt = Date.now();

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            order
        });

    } catch (error) {
        console.error('Cancel Order Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// CREATE GET API (Return Time Status)
router.get('/order/return-time/:id', isAuthenticated, async (req, res) => {

    try {

        const userId = req.session.userId;

        // CHECK USER
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { id } = req.params;

        // VALIDATE ORDER ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        // FIND ORDER
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // SECURITY CHECK
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // CHECK ORDER STATUS
        if (order.orderStatus !== 'delivery_completed') {
            return res.status(400).json({
                success: false,
                message: "Return available only for delivered orders"
            });
        }

        // DELIVERY TIME
        const deliveryCompletedAt = order.orderTimeline?.delivery_completedAt;

        if (!deliveryCompletedAt) {
            return res.status(400).json({
                success: false,
                message: "Delivery time not found"
            });
        }

        // RETURN WINDOW -> 7 DAYS
        const RETURN_WINDOW = 7 * 24 * 60 * 60 * 1000;

        const deliveredTime = new Date(deliveryCompletedAt).getTime();

        const now = Date.now();

        const expiryTime = deliveredTime + RETURN_WINDOW;

        const remainingTime = expiryTime - now;

        const isExpired = remainingTime <= 0;

        // SAFE REMAINING TIME
        const safeRemainingTime = isExpired ? 0 : remainingTime;

        // DAYS / HOURS / MINUTES
        const days = Math.floor(safeRemainingTime / (1000 * 60 * 60 * 24));

        const hours = Math.floor((safeRemainingTime / (1000 * 60 * 60)) % 24);

        const minutes = Math.floor((safeRemainingTime / (1000 * 60)) % 60);

        return res.status(200).json({
            success: true,
            data: {

                orderId: order._id,

                orderStatus: order.orderStatus,

                deliveryCompletedAt,

                expiryTime: new Date(expiryTime),

                remainingTime: safeRemainingTime,

                isExpired,

                canReturn: !isExpired,

                readableRemainingTime: isExpired ? "Expired" : `${days} days ${hours} hours ${minutes} minutes left`
            }
        });

    } catch (error) {

        console.error("RETURN TIME ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// VERIFY OTP & CONFIRM ORDER DELIVERY
router.put('/order/confirm-delivery/:id', isAuthenticated, async (req, res) => {

    try {

        const userId = req.session.userId;
        const { otp } = req.body;

        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // AUTH CHECK
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        if (order.orderStatus === 'delivery_completed') {
            return res.status(400).json({
                success: false,
                message: "Order already delivered"
            });
        }

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required"
            });
        }

        // =========================
        // FIXED OTP CHECK
        // =========================

        const isMatch = await bcrypt.compare(otp, order.deliveryOtp);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // OPTIONAL: check expiry
        if (order.deliveryOtpExpire && order.deliveryOtpExpire < Date.now()) {
            return res.status(400).json({
                success: false,
                message: "OTP expired"
            });
        }

        // UPDATE ORDER
        order.orderStatus = 'delivery_completed';
        order.paymentStatus = 'paid';

        order.orderTimeline = {
            ...order.orderTimeline,
            delivery_completedAt: new Date()
        };

        // CLEAR OTP
        order.deliveryOtp = null;
        order.deliveryOtpExpire = null;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order delivery confirmed successfully",
            order
        });

    } catch (error) {

        console.error("CONFIRM DELIVERY ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// ORDER RETURN REQUEST
router.put('/order/return-request/:id', isAuthenticated, async (req, res) => {

    try {

        const userId = req.session.userId;

        // CHECK USER
        const user = await Signup.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const { id } = req.params;
        const { returnReason, returnComments } = req.body;

        // VALIDATE ORDER ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        // VALIDATE INPUT
        if (!returnReason || returnReason.trim().length < 5 || returnReason.trim().length > 500) {
            return res.status(400).json({
                success: false,
                message: "Return reason must be 5-500 characters"
            });
        }

        if (returnComments && (returnComments.trim().length < 5 || returnComments.trim().length > 500)) {
            return res.status(400).json({
                success: false,
                message: "Return comments must be 5-500 characters"
            });
        }

        // FIND ORDER
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // SECURITY CHECK
        if (order.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access"
            });
        }

        // ONLY DELIVERED ORDERS
        if (order.orderStatus !== 'delivery_completed') {
            return res.status(400).json({
                success: false,
                message: "Only delivered orders can be returned"
            });
        }

        // PREVENT MULTIPLE REQUESTS
        if (['requested', 'approved'].includes(order.returnStatus)) {
            return res.status(400).json({
                success: false,
                message: "Return already requested"
            });
        }

        // GET DELIVERY TIME
        const deliveryCompletedAt =
            order.orderTimeline?.delivery_completedAt;

        if (!deliveryCompletedAt) {
            return res.status(400).json({
                success: false,
                message: "Delivery date not found"
            });
        }

        // RETURN WINDOW (7 DAYS)
        const RETURN_WINDOW = 7 * 24 * 60 * 60 * 1000;

        const deliveredTime =
            new Date(deliveryCompletedAt).getTime();

        const now = Date.now();

        const isExpired = now - deliveredTime > RETURN_WINDOW;

        if (isExpired) {

            order.returnStatus = 'expired';
            order.returnTimeline = {
                ...order.returnTimeline,
                returnExpiredAt: new Date()
            };

            await order.save();

            return res.status(400).json({
                success: false,
                message: "Return window expired"
            });
        }

        // CREATE RETURN REQUEST
        order.returnStatus = 'requested';
        order.returnReason = returnReason.trim();
        order.returnComments = returnComments?.trim() || null;

        order.returnTimeline = {
            ...order.returnTimeline,
            returnRequestedAt: new Date()
        };

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Return request submitted successfully",
            order
        });

    } catch (error) {

        console.error("RETURN REQUEST ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = router;