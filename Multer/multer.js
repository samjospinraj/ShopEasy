const multer  = require('multer');
const path = require('path');
const fs = require('fs');

// MULTER
function ensureDirectoryExists(dirPath) {

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

}

const storage = multer.diskStorage({
    
    destination : ( req , file , cb ) => {

        let uploadPath = "./Uploads/";

        if (file.fieldname === 'categoryImage') {
            uploadPath = './Uploads/category/';
        } else if (file.fieldname === 'subcategoryImage') {
            uploadPath = './Uploads/subcategory/';
        } else if (file.fieldname === 'sub_subcategoryImages') { 
            uploadPath = './Uploads/sub_subcategory/';
        } else if (file.fieldname === 'mainImage') {
            uploadPath = './Uploads/mainProduct/';
        } else if(file.fieldname === 'additionalImages') {
            uploadPath = './Uploads/Product/';
        } else if (file.fieldname=== 'productVideos') {
            uploadPath = './Uploads/Video/';
        } else if (file.fieldname === 'profileImage') {
            uploadPath = './Uploads/Profile/';
        } else if (file.fieldname === 'reviewImages') {
            uploadPath = './Uploads/Review/';
        } else if (file.fieldname === 'reviewVideos') {
            uploadPath = './Uploads/Reviewvideo/';
        }

        ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
    },

    filename : ( req , file , cb ) => {

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const cleanFileName = file.originalname //.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, uniqueSuffix + '-' + cleanFileName);

    }

});

const upload = multer({
    storage: storage,
    // limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;