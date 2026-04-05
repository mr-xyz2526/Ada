const express = require('express');
const interventionController = require('../controllers/interventionController');

const router = express.Router();
router.post('/', interventionController.addIntervention);

module.exports = router;
