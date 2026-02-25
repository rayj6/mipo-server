const express = require('express');
const authRoutes = require('./auth');
const apiRoutes = require('./api');
const adminRoutes = require('./admin');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', apiRoutes);

module.exports = router;
