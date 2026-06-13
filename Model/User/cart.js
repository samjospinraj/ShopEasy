const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products',
        required: true,
    },
    stockQuantity: {
        type: Number,
        required: true,
        min: 0,
        max: 100000
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
        default: 1,
    },
}, { _id: false });

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'signup',
        required: true,
    },

    items: [cartItemSchema],

}, {
    timestamps: true,
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;