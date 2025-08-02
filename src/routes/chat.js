const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const MessageService = require('../services/MessageService');

const router = express.Router();

// Get chat list
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const chats = await MessageService.getChats(req.user.id);
        res.json(chats);
    } catch (error) {
        console.error('Fetch chats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get messages for specific chat
router.get('/:jid', isAuthenticated, async (req, res) => {
    try {
        const messages = await MessageService.getChatMessages(req.user.id, req.params.jid);
        res.json(messages);
    } catch (error) {
        console.error('Fetch chat messages error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;