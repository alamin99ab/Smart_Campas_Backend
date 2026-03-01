/**
 * Room Management Controller - Classroom management
 */
const Room = require('../models/Room');
const School = require('../models/School');

exports.createRoom = async (req, res) => {
    try {
        const { roomNumber, building, floor, capacity, roomType } = req.body;
        if (!roomNumber) return res.status(400).json({ success: false, message: 'Room number required' });

        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        const room = await Room.create({
            schoolId: school._id,
            schoolCode: req.user.schoolCode,
            roomNumber,
            building,
            floor,
            capacity: capacity || 40,
            roomType: roomType || 'Classroom',
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, data: room });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Room already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getRooms = async (req, res) => {
    try {
        const { building, isActive } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (building) query.building = building;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const rooms = await Room.find(query).sort({ roomNumber: 1 }).lean();
        res.json({ success: true, data: rooms });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateRoom = async (req, res) => {
    try {
        const room = await Room.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

        const { roomNumber, building, floor, capacity, roomType, isActive } = req.body;
        if (roomNumber) room.roomNumber = roomNumber;
        if (building !== undefined) room.building = building;
        if (floor !== undefined) room.floor = floor;
        if (capacity !== undefined) room.capacity = capacity;
        if (roomType !== undefined) room.roomType = roomType;
        if (isActive !== undefined) room.isActive = isActive;
        await room.save();
        res.json({ success: true, data: room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const result = await Room.deleteOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Room not found' });
        res.json({ success: true, message: 'Room deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
