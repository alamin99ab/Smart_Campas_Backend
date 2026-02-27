/**
 * 🔄 REAL-TIME COMMUNICATION SERVICE
 * Advanced real-time features for Smart Campus
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class RealtimeService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map();
        this.rooms = new Map();
        this.events = new Map();
    }

    /**
     * Initialize Socket.IO server
     */
    initialize(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.NODE_ENV === 'production' 
                    ? ['https://yourdomain.com'] 
                    : ['http://localhost:3000', 'http://localhost:3001'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.setupMiddleware();
        this.setupEventHandlers();
        
        console.log('🔄 Real-time service initialized');
        return this.io;
    }

    /**
     * Setup authentication middleware
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return next(new Error('Authentication required'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                
                if (!user) {
                    return next(new Error('User not found'));
                }

                socket.user = user;
                socket.userId = user._id.toString();
                socket.schoolCode = user.schoolCode;
                socket.role = user.role;
                
                next();
            } catch (error) {
                next(new Error('Invalid authentication'));
            }
        });
    }

    /**
     * Setup main event handlers
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔗 User connected: ${socket.user.name} (${socket.userId})`);
            
            // Track connected user
            this.connectedUsers.set(socket.userId, {
                socketId: socket.id,
                user: socket.user,
                connectedAt: new Date(),
                lastActivity: new Date()
            });

            // Join user to their school room
            socket.join(`school_${socket.schoolCode}`);
            
            // Join role-based rooms
            socket.join(`role_${socket.role}`);
            
            // Join personal room
            socket.join(`user_${socket.userId}`);

            // Handle custom events
            this.setupUserEvents(socket);
            
            // Handle disconnection
            socket.on('disconnect', () => {
                this.handleDisconnection(socket);
            });
        });
    }

    /**
     * Setup user-specific event handlers
     */
    setupUserEvents(socket) {
        // Join classroom
        socket.on('join-classroom', (classId) => {
            socket.join(`classroom_${classId}`);
            socket.emit('joined-classroom', { classId });
            
            // Notify other students
            socket.to(`classroom_${classId}`).emit('student-joined', {
                student: {
                    id: socket.userId,
                    name: socket.user.name
                },
                timestamp: new Date()
            });
        });

        // Leave classroom
        socket.on('leave-classroom', (classId) => {
            socket.leave(`classroom_${classId}`);
            socket.emit('left-classroom', { classId });
            
            // Notify other students
            socket.to(`classroom_${classId}`).emit('student-left', {
                student: {
                    id: socket.userId,
                    name: socket.user.name
                },
                timestamp: new Date()
            });
        });

        // Real-time chat
        socket.on('send-message', (data) => {
            const message = {
                id: this.generateId(),
                sender: {
                    id: socket.userId,
                    name: socket.user.name,
                    role: socket.role,
                    avatar: socket.user.avatar
                },
                content: data.content,
                type: data.type || 'text',
                room: data.room,
                timestamp: new Date(),
                metadata: data.metadata || {}
            };

            // Send to room
            if (data.room) {
                this.io.to(data.room).emit('new-message', message);
            } else {
                // Direct message
                const recipientSocket = this.getSocketByUserId(data.recipientId);
                if (recipientSocket) {
                    recipientSocket.emit('new-message', message);
                    socket.emit('message-delivered', { messageId: message.id });
                }
            }

            // Store message (in production, save to database)
            this.storeMessage(message);
        });

        // Live quiz participation
        socket.on('quiz-answer', (data) => {
            const answer = {
                quizId: data.quizId,
                userId: socket.userId,
                answer: data.answer,
                timestamp: new Date()
            };

            // Send to teacher
            this.io.to(`quiz_${data.quizId}`).emit('quiz-answer-received', answer);
            
            // Update real-time results
            this.updateQuizResults(data.quizId, answer);
        });

        // Attendance tracking
        socket.on('mark-attendance', (data) => {
            const attendance = {
                userId: socket.userId,
                classId: data.classId,
                timestamp: new Date(),
                location: data.location,
                deviceInfo: data.deviceInfo
            };

            // Notify teacher
            this.io.to(`classroom_${data.classId}`).emit('attendance-marked', attendance);
            
            // Store attendance
            this.storeAttendance(attendance);
        });

        // Screen sharing
        socket.on('start-screen-share', (data) => {
            socket.join(`screen_share_${data.sessionId}`);
            socket.to(`screen_share_${data.sessionId}`).emit('screen-share-started', {
                userId: socket.userId,
                userName: socket.user.name,
                sessionId: data.sessionId
            });
        });

        socket.on('screen-share-data', (data) => {
            socket.to(`screen_share_${data.sessionId}`).emit('screen-share-data', {
                userId: socket.userId,
                data: data.data,
                sessionId: data.sessionId
            });
        });

        socket.on('stop-screen-share', (data) => {
            socket.leave(`screen_share_${data.sessionId}`);
            socket.to(`screen_share_${data.sessionId}`).emit('screen-share-stopped', {
                userId: socket.userId,
                sessionId: data.sessionId
            });
        });

        // Whiteboard collaboration
        socket.on('whiteboard-draw', (data) => {
            socket.to(`whiteboard_${data.whiteboardId}`).emit('whiteboard-update', {
                userId: socket.userId,
                data: data.drawData,
                whiteboardId: data.whiteboardId
            });
        });

        // Real-time notifications
        socket.on('mark-notification-read', (notificationId) => {
            // Update notification status
            this.updateNotificationStatus(socket.userId, notificationId);
        });

        // Typing indicators
        socket.on('typing-start', (data) => {
            socket.to(data.room || `user_${data.recipientId}`).emit('user-typing', {
                userId: socket.userId,
                userName: socket.user.name,
                room: data.room
            });
        });

        socket.on('typing-stop', (data) => {
            socket.to(data.room || `user_${data.recipientId}`).emit('user-stopped-typing', {
                userId: socket.userId,
                room: data.room
            });
        });

        // Online status updates
        socket.on('update-status', (status) => {
            const userInfo = this.connectedUsers.get(socket.userId);
            if (userInfo) {
                userInfo.status = status;
                userInfo.lastActivity = new Date();
                
                // Broadcast status change
                socket.to(`school_${socket.schoolCode}`).emit('user-status-changed', {
                    userId: socket.userId,
                    userName: socket.user.name,
                    status: status
                });
            }
        });
    }

    /**
     * Handle user disconnection
     */
    handleDisconnection(socket) {
        console.log(`🔌 User disconnected: ${socket.user.name} (${socket.userId})`);
        
        // Remove from connected users
        this.connectedUsers.delete(socket.userId);
        
        // Notify others
        socket.to(`school_${socket.schoolCode}`).emit('user-disconnected', {
            userId: socket.userId,
            userName: socket.user.name,
            timestamp: new Date()
        });
    }

    /**
     * Send notification to specific user
     */
    sendNotificationToUser(userId, notification) {
        const socket = this.getSocketByUserId(userId);
        if (socket) {
            socket.emit('notification', {
                id: this.generateId(),
                ...notification,
                timestamp: new Date()
            });
            return true;
        }
        return false;
    }

    /**
     * Send notification to role
     */
    sendNotificationToRole(role, notification) {
        this.io.to(`role_${role}`).emit('notification', {
            id: this.generateId(),
            ...notification,
            timestamp: new Date()
        });
    }

    /**
     * Send notification to school
     */
    sendNotificationToSchool(schoolCode, notification) {
        this.io.to(`school_${schoolCode}`).emit('notification', {
            id: this.generateId(),
            ...notification,
            timestamp: new Date()
        });
    }

    /**
     * Broadcast emergency alert
     */
    broadcastEmergencyAlert(alert) {
        this.io.emit('emergency-alert', {
            id: this.generateId(),
            type: 'emergency',
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            actions: alert.actions || [],
            timestamp: new Date()
        });
    }

    /**
     * Create live quiz session
     */
    createLiveQuiz(quizData) {
        const sessionId = this.generateId();
        this.io.to(`quiz_${sessionId}`).emit('quiz-started', {
            sessionId,
            quiz: quizData,
            timestamp: new Date()
        });
        return sessionId;
    }

    /**
     * Get online users in school
     */
    getOnlineUsers(schoolCode) {
        const onlineUsers = [];
        this.connectedUsers.forEach((userInfo, userId) => {
            if (userInfo.user.schoolCode === schoolCode) {
                onlineUsers.push({
                    userId,
                    name: userInfo.user.name,
                    role: userInfo.user.role,
                    status: userInfo.status || 'online',
                    connectedAt: userInfo.connectedAt,
                    lastActivity: userInfo.lastActivity
                });
            }
        });
        return onlineUsers;
    }

    /**
     * Get classroom participants
     */
    getClassroomParticipants(classId) {
        const room = this.io.sockets.adapter.rooms.get(`classroom_${classId}`);
        if (!room) return [];
        
        const participants = [];
        room.forEach(socketId => {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                participants.push({
                    userId: socket.userId,
                    name: socket.user.name,
                    role: socket.user.role,
                    joinedAt: socket.handshake.time
                });
            }
        });
        return participants;
    }

    /**
     * Helper methods
     */
    getSocketByUserId(userId) {
        const userInfo = this.connectedUsers.get(userId);
        if (userInfo) {
            return this.io.sockets.sockets.get(userInfo.socketId);
        }
        return null;
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    storeMessage(message) {
        // In production, store in database
        console.log('📝 Message stored:', message.id);
    }

    storeAttendance(attendance) {
        // In production, store in database
        console.log('📅 Attendance stored:', attendance.userId);
    }

    updateQuizResults(quizId, answer) {
        // In production, update in database
        console.log('📊 Quiz updated:', quizId);
    }

    updateNotificationStatus(userId, notificationId) {
        // In production, update in database
        console.log('🔔 Notification read:', notificationId);
    }

    /**
     * Get connection statistics
     */
    getStats() {
        return {
            totalConnected: this.connectedUsers.size,
            connectionsByRole: this.getConnectionsByRole(),
            connectionsBySchool: this.getConnectionsBySchool(),
            activeRooms: this.getActiveRooms(),
            uptime: process.uptime()
        };
    }

    getConnectionsByRole() {
        const roleStats = {};
        this.connectedUsers.forEach((userInfo) => {
            const role = userInfo.user.role;
            roleStats[role] = (roleStats[role] || 0) + 1;
        });
        return roleStats;
    }

    getConnectionsBySchool() {
        const schoolStats = {};
        this.connectedUsers.forEach((userInfo) => {
            const school = userInfo.user.schoolCode;
            schoolStats[school] = (schoolStats[school] || 0) + 1;
        });
        return schoolStats;
    }

    getActiveRooms() {
        const rooms = {};
        this.io.sockets.adapter.rooms.forEach((sockets, roomName) => {
            if (!roomName.startsWith('#')) {
                rooms[roomName] = sockets.size;
            }
        });
        return rooms;
    }
}

module.exports = RealtimeService;
