const mongoose = require("mongoose");

/* ---------------- SIGNUP SCHEMA ---------------- */

const profileImageSchema = new mongoose.Schema({
    filename: {
        type: String,
        default: null
    },
    path: {
        type: String,
        default: null
    },
    size: {
        type: Number,
        default: 0
    }
}, { _id: false });

const signupSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            minlength: [2, "Full name must be at least 2 characters"],
            maxlength: [50, "Full name cannot exceed 50 characters"]
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true  // Add this
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
        },

        phone: {
            type: String,
            trim: true,
            default: null,
            minlength: [10, "Phone must be at least 10 digits"],
            maxlength: [15, "Phone cannot exceed 15 digits"],
            match: [/^[0-9+\-\s]*$/, "Invalid phone number"]
        },

        address: {
            type: String,
            trim: true,
            default: null,
            maxlength: [200, "Address cannot exceed 200 characters"]
        },

        // profile image
        profileImage: {
            type: profileImageSchema,
            default: null
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            maxlength: [100, "Password too long"],
            match: [
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                "Password must contain uppercase, lowercase and a number"
            ]
        },

        confirmPassword: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            maxlength: [100, "Password too long"],
            match: [
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                "Password must contain uppercase, lowercase and a number"
            ]
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        isBlocked: {
            type: Boolean,
            default: false
        },

        termsAccepted: {
            type: Boolean,
            required: [true, "You must accept Terms & Privacy Policy"],
            validate: {
                validator: v => v === true,
                message: "You must accept Terms & Privacy Policy"
            }
        },

    },
    {
        timestamps: true
    }
);


const Signup = mongoose.model("signup", signupSchema);

module.exports = { Signup };