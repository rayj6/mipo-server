const express = require('express');
const authRoutes = require('./auth');
const apiRoutes = require('./api');
const adminRoutes = require('./admin');
const { apiGeneralLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', apiGeneralLimiter, apiRoutes);

module.exports = router;
