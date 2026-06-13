const mongoose = require('mongoose');

const reviewItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'products',
            required: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        comment: {
            type: String,
            trim: true,
            minlength: 10,
            maxlength: 500,
        },

        reviewImages: [
            {
                filename: String,
                path: String,
                size: Number,
                mimetype: String,
            }
        ],

        reviewVideos: [
            {
                filename: String,
                path: String,
                size: Number,
                mimetype: String,
            }
        ],
    },
    { _id: false }
);

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'signup',
            required: true,
        },

        reviewItems: [reviewItemSchema],
    },
    { timestamps: true }
);

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;