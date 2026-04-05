const express = require('express');
const studentController = require('../controllers/studentController');

const router = express.Router();

router.get('/', studentController.getStudents);
router.get('/:id', studentController.getStudentById);
router.get('/:id/analytics', studentController.getAnalytics);
router.get('/:id/risk', studentController.getRisk);

module.exports = router;
