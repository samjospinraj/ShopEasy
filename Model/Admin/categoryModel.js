const mongoose = require('mongoose');

// CATEGORY SCHEMA
const categorySchema = new mongoose.Schema({
    categoryName: {
        type: String,
        minlength: 5,
        maxlength: 50,
        required: true,
        trim: true
    },

    url: {
        type: String,
        minlength: 5,
        maxlength: 100,
        required: true,
        trim: true,
        lowercase: true
    },

    icon: {
        type: String,
        required: true,
        trim: true
    },

    status: {
        type: String,
        enum: ['active', 'inactive'], // enforce valid values
        default: 'active',
        required: true
    },

    description: {
        type: String,
        minlength: 5,
        maxlength: 250,
        required: true,
        trim: true
    },

    categoryImage: {
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    }
}, {
    timestamps: { createdAt: 'created_At', updatedAt: 'updated_At' }
});

const subcategorySchema = new mongoose.Schema({
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId, // correct type
        ref: "category", // match your model name (case-sensitive)
        required: [true, "Parent category is required"]
    },

    subcategoryName: {
        type: String,
        minlength: 3,
        maxlength: 50,
        required: true,
        trim: true
    },

    icon: {
        type: String,
        required: true,
        trim: true
    },

    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
        required: true
    },

    description: {
        type: String,
        minlength: 5,
        maxlength: 250,
        required: true,
        trim: true
    },

    subcategoryImage: {
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    }

}, {
    timestamps: { createdAt: 'created_At', updatedAt: 'updated_At' }
});

const sub_subcategorySchema = new mongoose.Schema({

    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "category",
        required: [true, "Parent category is required"]
    },

    subparentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subcategory",
        required: [true, "Parent subcategory is required"]
    },

    subSubName: {
        type: String,
        required: true,
        minlength: [3, "sub_Subcategory name must be at least 3 characters"],
        maxlength: [50, "sub_Subcategory name cannot exceed 50 characters"],
        trim: true
    },

    subSubIcon: {
        type: String,
        minlength: [2, "Icon must be at least 2 characters"],
        maxlength: [100, "Icon cannot exceed 100 characters"],
        default: null
    },

    subSubStatus: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
        required: true
    },

    subSubDesc: {
        type: String,
        minlength: [10, "Description must be at least 10 characters"],
        maxlength: [500, "Description cannot exceed 500 characters"],
        default: null
    },

    sub_subcategoryImages: {
        filename: String,
        path: String,
        size: Number,
        mimetype: String
    }

}, {
    timestamps: { createdAt: 'created_At', updatedAt: 'updated_At' }
});

const Category = mongoose.model("category", categorySchema);
const subCategory = mongoose.model("subcategory", subcategorySchema);
const sub_subCategory = mongoose.model("sub_subcategory", sub_subcategorySchema);

module.exports = { Category, subCategory, sub_subCategory };