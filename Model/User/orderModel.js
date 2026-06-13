const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'products',
        required: true,
    },

    quantity: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
    },

    price: {
        type: Number,
        required: true,
        min: 0,
    },

    productName: {
        type: String,
        required: true,
        trim: true,
    },

    dimensions: {
        shippingCost: {
            type: Number,
            default: 0,
            min: 0,
        }
    },

    deliveryTimeline: {

        minTime: {
            type: Date,
            default: null,
        },
        maxTime: {
            type: Date,
            default: null,
        }
    },

}, { _id: false });

const orderSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'signup',
        required: true,
        index: true,
    },

    shippingAddress: {

        fullName: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 50,
        },

        phone: {
            type: String,
            required: true,
            match: /^[0-9]{10,15}$/,
        },

        address: {
            type: String,
            required: true,
            trim: true,
            minlength: 5,
            maxlength: 200,
        },

        city: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },

        state: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },

        postalCode: {
            type: String,
            required: true,
            trim: true,
            minlength: 6,
            maxlength: 10,
        },

        country: {
            type: String,
            default: 'India',
            trim: true,
        }
    },

    paymentMethod: {
        type: String,
        enum: ['onlinePayment', 'cashOnDelivery'],
        required: true,
    },

    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
    },

    paymentTimeline: {
        pendingAt: { type: Date, default: Date.now },
        paidAt: { type: Date, default: null },
        failedAt: { type: Date, default: null },
        refundedAt: { type: Date, default: null },
    },

    orderStatus: {
        type: String,
        enum: [
            'pending',
            'confirmed',
            'processing',
            'packed',
            'shipped',
            'out_for_delivery',
            'delivered',
            'delivery_failed',
            'delivery_completed',
            'cancelled',
            'returned'
        ],
        default: 'pending',
    },

    returnStatus: {
        type: String,
        enum: [
            'none',
            'requested',
            'approved',
            'rejected',
            'completed',
            'expired'
        ],
        default: 'none',
    },

    returnReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },

    returnComments: {
        type: String,
        trim: true,
        maxlength: 500,
    },

    refundReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },

    razorpay: {

        orderId: {
            type: String,
            default: null,
        },

        paymentId: {
            type: String,
            default: null,
        }

    },

    totals: {

        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },

        shippingFee: {
            type: Number,
            default: 0,
            min: 0,
        },

        tax: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        }

    },

    orderTimeline: {

        orderedAt: {
            type: Date,
            default: Date.now,
        },

        confirmedAt: {
            type: Date,
            default: null,
        },

        processingAt: {
            type: Date,
            default: null,
        },

        packedAt: {
            type: Date,
            default: null,
        },

        shippedAt: {
            type: Date,
            default: null,
        },

        out_for_delivery: {
            type: Date,
            default: null,
        },

        deliveredAt: {
            type: Date,
            default: null
        },

        deliveredMinAt: {
            type: Date,
            default: null
        },

        deliveredMaxAt: {
            type: Date,
            default: null
        },

        deliveryFailedAt: {
            type: Date,
            default: null,
        },

        delivery_completedAt: {
            type: Date,
            default: null,
        },

        cancelledAt: {
            type: Date,
            default: null,
        },

    },

    deliveryOtp: {
        type: String
    },

    deliveryOtpExpire: {
        type: Date,
        default: () => new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },

    returnTimeline: {

        // RETURN FLOW

        returnRequestedAt: {
            type: Date,
            default: null
        },

        returnApprovedAt: {
            type: Date,
            default: null
        },

        returnCompletedAt: {
            type: Date,
            default: null,
        },

        returnRejectedAt: {
            type: Date,
            default: null,
        },

        returnExpiredAt: {
            type: Date,
            default: null,
        }
    },

    returnrejectReason: {
        type: String,
        trim: true,
        maxlength: 500,
    },

    returnrejectComment: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    
    // ────────── Stock tracking (improved) ──────────


    inventoryAction: {
        type: String,
        enum: ["none", "confirmed", "cancelled", "returned"],
        default: "none"
    },

    items: {
        type: [orderItemSchema],
        validate: [
            arr => arr.length > 0,
            'Order must contain items'
        ]
    }

}, {
    timestamps: true,
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;