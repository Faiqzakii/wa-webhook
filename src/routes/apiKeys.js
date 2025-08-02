const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const ApiKeyService = require('../services/ApiKeyService');

const router = express.Router();

// API keys management page
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const keys = await ApiKeyService.getUserApiKeys(req.user.id);
        
        res.render('api-keys', { 
            keys, 
            error: null, 
            success: req.query.success, 
            page: 'api-keys' 
        });
    } catch (error) {
        console.error('Error loading API keys page:', error);
        res.render('api-keys', { 
            keys: [], 
            error: 'Failed to load API keys.', 
            success: null, 
            page: 'api-keys' 
        });
    }
});

// Generate new API key
router.post('/generate', isAuthenticated, async (req, res) => {
    try {
        const apiKey = await ApiKeyService.generateApiKey(req.user.id);
        
        res.render('api-keys', { 
            keys: [{ 
                ...apiKey, 
                raw: apiKey.raw_key, 
                created_at: new Date() 
            }], 
            success: 'API key generated. Copy it now, it will not be shown again!', 
            page: 'api-keys', 
            error: null 
        });
    } catch (error) {
        console.error('Failed to generate API key:', error);
        res.render('api-keys', { 
            keys: [], 
            error: 'Failed to generate API key', 
            page: 'api-keys',
            success: null
        });
    }
});

// Delete API key
router.post('/delete/:id', isAuthenticated, async (req, res) => {
    try {
        await ApiKeyService.deleteApiKey(req.user.id, req.params.id);
        res.redirect('/api-keys?success=' + encodeURIComponent('API key deleted successfully.'));
    } catch (error) {
        console.error('Error deleting API key:', error);
        res.redirect('/api-keys');
    }
});

module.exports = router;