const express = require('express');
const router = express.Router();
const {
    createEvent,
    getEvents,
    getEventById,
    updateEvent,
    deleteEvent
} = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);
router.route('/')
    .post(createEvent)
    .get(getEvents);
router.route('/:id')
    .get(getEventById)
    .put(updateEvent)
    .delete(deleteEvent);

module.exports = router;
