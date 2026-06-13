const express = require('express');
const router = express.Router();
const { Signup } = require('../../Model/User/userAuther');
const Order = require('../../Model/User/orderModel');
const Review = require('../../Model/User/reviewModel');
const mongoose = require('mongoose');
const upload = require('../../Multer/multer');

// user Authentication Middleware
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

// // REVIEWS
router.post('/review', isAuthenticated, upload.fields([{ name: 'reviewImages', maxCount: 5 }, { name: 'reviewVideos', maxCount: 3 }]), async (req, res) => {

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

        const { productId, rating, comment } = req.body;

        // VALIDATION
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid productId"
            });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        if (comment && (comment.length < 10 || comment.length > 500)) {
            return res.status(400).json({
                success: false,
                message: "Comment must be between 10 and 500 characters"
            });
        }


        if (req.files.reviewImages && req.files.reviewImages.length > 5) {
            return res.status(400).json({
                success: false,
                message: "Maximum 5 images allowed"
            });
        }

        if (req.files.reviewVideos && req.files.reviewVideos.length > 3) {
            return res.status(400).json({
                success: false,
                message: "Maximum 3 videos allowed"
            });
        }

        // GET FILES FROM MULTER
        const images =
            req.files?.reviewImages?.map(file => ({
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            })) || [];

        const videos =
            req.files?.reviewVideos?.map(file => ({
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            })) || [];

        // FIND REVIEW DOC
        let reviewDoc = await Review.findOne({ userId });

        if (!reviewDoc) {
            reviewDoc = new Review({
                userId,
                reviewItems: []
            });
        }

        // CHECK EXISTING REVIEW
        const exists = reviewDoc.reviewItems.find(
            item => item.productId.toString() === productId
        );

        if (exists) {
            return res.status(400).json({
                success: false,
                message: "You already reviewed this product"
            });
        }

        // ADD REVIEW
        reviewDoc.reviewItems.push({
            productId,
            rating,
            comment,
            reviewImages: images,
            reviewVideos: videos,
            createdAt: new Date()
        });

        await reviewDoc.save();
        console.log(reviewDoc);

        return res.status(201).json({
            success: true,
            message: "Review added successfully",
            review: reviewDoc
        });

    } catch (error) {

        console.error("REVIEW ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}
);

// REVIEWS
router.get('/reviews' , async (req, res) => {
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

// REVIEW RATING COUNT
router.get('/reviews/ratings/count' , async (req, res) => {
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

module.exports = router;