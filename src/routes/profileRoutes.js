const express = require('express');
const router = express.Router();
const { createProfile, getProfileById, getAllProfiles, deleteProfile } = require('../controllers/profileController');

router.post('/', createProfile);
router.get('/:id', getProfileById);
router.get('/', getAllProfiles);
router.delete('/:id', deleteProfile);  

module.exports = router;