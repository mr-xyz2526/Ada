const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.get('/mentors', adminController.getMentors);
router.post('/assign-mentor', adminController.assignMentor);

module.exports = router;
