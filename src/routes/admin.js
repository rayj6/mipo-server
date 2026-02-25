const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/templates', adminController.listTemplates);
router.get('/templates/:id', adminController.getTemplate);
router.put('/templates/:id', express.json({ limit: '5mb' }), adminController.updateTemplate);

router.get('/users', adminController.listUsers);
router.get('/config', adminController.getConfig);

module.exports = router;
