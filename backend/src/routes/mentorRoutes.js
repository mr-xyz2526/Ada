const express = require('express');
const mentorController = require('../controllers/mentorController');

const router = express.Router();
router.get('/dashboard', mentorController.getDashboard);

module.exports = router;
