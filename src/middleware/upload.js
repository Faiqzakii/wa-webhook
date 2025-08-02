const multer = require('multer');
const path = require('path');
const { config } = require('../config');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const fileExt = path.extname(file.originalname).toLowerCase();
        const { allowedExtensions, allowedMimeTypes } = config.upload;
        
        const isValidExtension = allowedExtensions.includes(fileExt);
        const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
        
        if (isValidExtension || isValidMimeType) {
            cb(null, true);
        } else {
            cb(new Error('Only .vcf and .csv files are allowed!'), false);
        }
    }
});

module.exports = { upload };