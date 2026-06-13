const mongoose = require("mongoose");

/* ---------------- OTP SCHEMA ---------------- */
// OTP Schema - FIXED
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    unique: true  // Keep this unique
  },
  otp: {
    type: String,
    required: true,
    // Remove unique: true from this field!
    index: true  // Just index, not unique
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 45 * 60 * 1000) // 45 minutes
  },

  attempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Auto-delete after 10 minutes (TTL index)
  }
});

// otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model("Otp", otpSchema);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
    },
    otp: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: { createdAt: 'created_At', updatedAt: 'updated_At' }
  })

const User = mongoose.model("User", userSchema);


module.exports = { Otp, User };