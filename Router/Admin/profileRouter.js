const express = require('express');
const upload = require('../../Multer/multer');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }
    return res.redirect('/admin');
};


// ADMIN PROFILE PAGE
router.get('/profile', async (req, res, next) => {

    try {

        res.render('../Views/Admin/profile');

    } catch (error) {

        console.log(error);
        res.status(500).json({ message: "server error" });
        next();

    }

});

module.exports = router;