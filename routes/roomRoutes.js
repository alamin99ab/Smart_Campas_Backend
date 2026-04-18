const express = require('express');
const router = express.Router();
const {
    createRoom,
    getRooms,
    updateRoom,
    deleteRoom
} = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

router.post('/', authorize('principal', 'admin', 'super_admin'), createRoom);
router.get('/', authorize('principal', 'admin', 'teacher', 'super_admin'), getRooms);
router.put('/:id', authorize('principal', 'admin'), updateRoom);
router.delete('/:id', authorize('principal', 'admin'), deleteRoom);

module.exports = router;
