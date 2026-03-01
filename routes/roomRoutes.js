const express = require('express');
const router = express.Router();
const {
    createRoom,
    getRooms,
    updateRoom,
    deleteRoom
} = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', authorize('principal', 'admin', 'super_admin'), createRoom);
router.get('/', authorize('principal', 'admin', 'teacher', 'super_admin'), getRooms);
router.put('/:id', authorize('principal', 'admin'), updateRoom);
router.delete('/:id', authorize('principal', 'admin'), deleteRoom);

module.exports = router;
