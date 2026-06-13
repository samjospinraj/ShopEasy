const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'products',
            required: true,
        },
    },
    { _id: false }
);

const wishlistSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'signup',
            required: true,
        },

        items: [wishlistItemSchema],

    },
    {
        timestamps: true,
    }
);

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;