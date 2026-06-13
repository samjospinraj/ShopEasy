const mongoose = require("mongoose");

const specSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    value: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 300
    }
}, { _id: false });

const productSchema = new mongoose.Schema({

    productName: {
        type: String,
        required: true,
        trim: true,
        index: true,
        minlength: 3,
        maxlength: 120
    },

    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
        minlength: 3,
        maxlength: 60
    },

    brand: {
        type: String,
        trim: true,
        minlength: 2,
        maxlength: 60
    },

    model: {
        type: String,
        trim: true,
        minlength: 1,
        maxlength: 60
    },

    // FIXED refs
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "category",
        required: true
    },

    subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subcategory",
        default: null
    },

    sub_subcategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sub_subcategory",
        default: null
    },

    size: {
        type: String,
        enum: ["S", "M", "L", "XL" , "NONE"],
        required: false
    },

    price: {
        type: Number,
        required: true,
        min: 0,
        max: 1000000
    },

    comparePrice: {
        type: Number,
        default: 0,
        min: 0,
        max: 1000000
    },

    costPrice: {
        type: Number,
        default: 0,
        min: 0,
        max: 1000000
    },

    offerPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    stockQuantity: {
        type: Number,
        required: true,
        min: 0,
        max: 100000
    },

    lowStockThreshold: {
        type: Number,
        default: 5,
        min: 0,
        max: 1000
    },

    barcode: {
        type: String,
        trim: true,
        minlength: 3,
        maxlength: 100
    },

    keySpecs: {
        type: [specSchema],
        validate: v => v.length <= 50
    },

    detailedSpecs: {
        type: [specSchema],
        validate: v => v.length <= 50
    },

    designSpecs: {
        type: [specSchema],
        validate: v => v.length <= 50
    },

    perfSpecs: {
        type: [specSchema],
        validate: v => v.length <= 50
    },

    additionalSpecs: {
        type: [specSchema],
        validate: v => v.length <= 50
    },

    specTitle: { type: String, maxlength: 100 },
    designTitle: { type: String, maxlength: 100 },
    performanceTitle: { type: String, maxlength: 100 },
    additionalTitle: { type: String, maxlength: 100 },

    shortDescription: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 300
    },

    fullDescription: {
        type: String,
        required: true,
        minlength: 20,
        maxlength: 5000
    },

    shippingClass: {
        type: String,
        enum: ["Standard", "Express"],
        default: "Standard"
    },

    freeShipping: {
        type: Boolean,
        default: false
    },

    dimensions: {
        length: { type: Number, min: 0, max: 10000, default: 0 },
        width: { type: Number, min: 0, max: 10000, default: 0 },
        height: { type: Number, min: 0, max: 10000, default: 0 },
        weight: { type: Number, min: 0, max: 1000, default: 0 },
        shippingCost: { type: Number, min: 0, max: 1000, default: 0 },
    },

    // ✅ FIXED DELIVERY SYSTEM (IMPORTANT)
    delivery: {
        minDays: {
            type: Number,
            default: 1,
            min: 0,
            max: 365
        },

        maxDays: {
            type: Number,
            default: 4,
            min: 0,
            max: 365
        }
    },

    deliveryTimeline: {

        minTime: {
            type: Date,
            default: null
        },

        maxTime: {
            type: Date,
            default: null
        }
    },

    mainImage: {
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    },

    additionalImages: [{
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    }],

    productVideos: [{
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    }],

    status: {
        type: String,
        enum: ["draft", "active", "inactive"],
        default: "draft",
        index: true
    },

    visibility: {
        type: String,
        enum: ["visible", "hidden"],
        default: "visible",
        index: true
    },

    tags: {
        type: [String],
        validate: v => v.length <= 20,
        default: []
    },

    internalNotes: {
        type: String,
        maxlength: 1000,
        default: ""
    },

}, {
    timestamps: { createdAt: 'created_At', updatedAt: 'updated_At' }
});

productSchema.pre("save", function () {
    const now = Date.now();

    const minDays = this.delivery?.minDays ?? 1;
    const maxDays = this.delivery?.maxDays ?? 4;
    
    
    this.deliveryTimeline = {
        minTime: new Date(now + minDays * 24 * 60 * 60 * 1000),
        maxTime: new Date(now + maxDays * 24 * 60 * 60 * 1000),
    };

    // next();
});

productSchema.pre("findOneAndUpdate", function () {
    const update = this.getUpdate();

    const delivery = update?.$set?.delivery || update?.delivery || {};

    const minDays = delivery.minDays ?? 1;
    const maxDays = delivery.maxDays ?? 4;

    const now = Date.now();

    const deliveryTimeline = {
        minTime: new Date(now + minDays * 24 * 60 * 60 * 1000),
        maxTime: new Date(now + maxDays * 24 * 60 * 60 * 1000),
    };

    if (update.$set) {
        update.$set.deliveryTimeline = deliveryTimeline;
    } else {
        update.deliveryTimeline = deliveryTimeline;
    }

    this.setUpdate(update);
});

const Product = mongoose.model("products", productSchema);
module.exports = { Product };