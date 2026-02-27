/**
 * 🌐 IOT INTEGRATION SERVICE
 * Smart Campus IoT device management and automation
 */

const mqtt = require('mqtt');
const WebSocket = require('ws');
const EventEmitter = require('events');

class IoTService extends EventEmitter {
    constructor() {
        super();
        this.mqttClient = null;
        this.wsServer = null;
        this.devices = new Map();
        this.sensors = new Map();
        this.automations = new Map();
        this.alerts = [];
        this.deviceTypes = {
            temperature: 'TEMP_SENSOR',
            humidity: 'HUMID_SENSOR',
            motion: 'MOTION_SENSOR',
            door: 'DOOR_SENSOR',
            light: 'LIGHT_CONTROLLER',
            camera: 'CAMERA',
            attendance: 'RFID_READER',
            smartboard: 'SMART_BOARD',
            projector: 'PROJECTOR',
            hvac: 'HVAC_CONTROLLER',
            energy: 'ENERGY_METER'
        };
    }

    /**
     * Initialize IoT services
     */
    async initialize() {
        try {
            // Initialize MQTT broker connection
            await this.connectMQTT();
            
            // Initialize WebSocket server for real-time device data
            await this.initializeWebSocket();
            
            // Start device discovery
            await this.startDeviceDiscovery();
            
            // Initialize automation rules
            await this.initializeAutomations();
            
            console.log('🌐 IoT Service initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ IoT Service initialization failed:', error.message);
            return false;
        }
    }

    /**
     * Connect to MQTT broker
     */
    async connectMQTT() {
        return new Promise((resolve, reject) => {
            this.mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', {
                clientId: 'smart-campus-iot',
                username: process.env.MQTT_USERNAME,
                password: process.env.MQTT_PASSWORD,
                keepalive: 60,
                reconnectPeriod: 1000,
                connectTimeout: 30 * 1000
            });

            this.mqttClient.on('connect', () => {
                console.log('🔗 Connected to MQTT broker');
                
                // Subscribe to device topics
                this.subscribeToDeviceTopics();
                resolve();
            });

            this.mqttClient.on('error', (error) => {
                console.error('❌ MQTT connection error:', error);
                reject(error);
            });

            this.mqttClient.on('message', (topic, message) => {
                this.handleDeviceMessage(topic, message);
            });
        });
    }

    /**
     * Initialize WebSocket server
     */
    async initializeWebSocket() {
        this.wsServer = new WebSocket.Server({ port: 8080 });
        
        this.wsServer.on('connection', (ws) => {
            console.log('🔌 IoT WebSocket client connected');
            
            // Send current device status
            ws.send(JSON.stringify({
                type: 'initial_status',
                devices: this.getDeviceStatus(),
                timestamp: new Date().toISOString()
            }));

            ws.on('close', () => {
                console.log('🔌 IoT WebSocket client disconnected');
            });
        });

        console.log('🌐 IoT WebSocket server running on port 8080');
    }

    /**
     * Subscribe to device topics
     */
    subscribeToDeviceTopics() {
        const topics = [
            'smartcampus/+/temperature',
            'smartcampus/+/humidity',
            'smartcampus/+/motion',
            'smartcampus/+/door',
            'smartcampus/+/energy',
            'smartcampus/+/attendance',
            'smartcampus/+/alert',
            'smartcampus/+/status'
        ];

        topics.forEach(topic => {
            this.mqttClient.subscribe(topic, (err) => {
                if (err) {
                    console.error(`❌ Failed to subscribe to ${topic}:`, err);
                } else {
                    console.log(`✅ Subscribed to ${topic}`);
                }
            });
        });
    }

    /**
     * Handle incoming device messages
     */
    handleDeviceMessage(topic, message) {
        try {
            const data = JSON.parse(message.toString());
            const topicParts = topic.split('/');
            const deviceId = topicParts[1];
            const sensorType = topicParts[2];

            // Update device status
            this.updateDeviceStatus(deviceId, sensorType, data);

            // Emit real-time event
            this.emit('deviceData', {
                deviceId,
                sensorType,
                data,
                timestamp: new Date().toISOString()
            });

            // Broadcast to WebSocket clients
            this.broadcastToWebSocket({
                type: 'device_update',
                deviceId,
                sensorType,
                data,
                timestamp: new Date().toISOString()
            });

            // Check for alerts
            this.checkForAlerts(deviceId, sensorType, data);

            // Process automations
            this.processAutomations(deviceId, sensorType, data);

        } catch (error) {
            console.error('❌ Error processing device message:', error);
        }
    }

    /**
     * Register new IoT device
     */
    registerDevice(deviceData) {
        const device = {
            id: deviceData.id,
            name: deviceData.name,
            type: deviceData.type,
            location: deviceData.location,
            room: deviceData.room,
            building: deviceData.building,
            status: 'offline',
            lastSeen: null,
            capabilities: deviceData.capabilities || [],
            settings: deviceData.settings || {},
            metadata: {
                manufacturer: deviceData.manufacturer,
                model: deviceData.model,
                firmware: deviceData.firmware,
                installedAt: new Date().toISOString(),
                lastMaintenance: null
            }
        };

        this.devices.set(deviceData.id, device);
        
        console.log(`📱 IoT device registered: ${deviceData.name} (${deviceData.id})`);
        
        // Send configuration to device
        this.sendDeviceConfiguration(deviceData.id);
        
        return {
            success: true,
            device,
            message: 'Device registered successfully'
        };
    }

    /**
     * Control IoT device
     */
    controlDevice(deviceId, command, parameters = {}) {
        const device = this.devices.get(deviceId);
        if (!device) {
            return {
                success: false,
                message: 'Device not found'
            };
        }

        const controlMessage = {
            command,
            parameters,
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId()
        };

        const topic = `smartcampus/${deviceId}/control`;
        
        this.mqttClient.publish(topic, JSON.stringify(controlMessage), (err) => {
            if (err) {
                console.error(`❌ Failed to control device ${deviceId}:`, err);
                return {
                    success: false,
                    message: 'Failed to send control command'
                };
            }
            
            console.log(`🎮 Control sent to device ${deviceId}: ${command}`);
            
            // Update device status
            device.status = 'processing';
            device.lastCommand = controlMessage;
            
            return {
                success: true,
                message: 'Control command sent successfully',
                requestId: controlMessage.requestId
            };
        });
    }

    /**
     * Get device status
     */
    getDeviceStatus(deviceId = null) {
        if (deviceId) {
            const device = this.devices.get(deviceId);
            return device || null;
        }
        
        const devices = [];
        this.devices.forEach((device, id) => {
            devices.push({
                id,
                ...device,
                sensors: this.sensors.get(id) || {}
            });
        });
        
        return devices;
    }

    /**
     * Create automation rule
     */
    createAutomation(rule) {
        const automation = {
            id: this.generateAutomationId(),
            name: rule.name,
            description: rule.description,
            triggers: rule.triggers, // conditions that trigger the automation
            actions: rule.actions, // actions to execute when triggered
            enabled: rule.enabled !== false,
            createdAt: new Date().toISOString(),
            lastTriggered: null,
            triggerCount: 0
        };

        this.automations.set(automation.id, automation);
        
        console.log(`⚙️ Automation created: ${rule.name}`);
        
        return {
            success: true,
            automation,
            message: 'Automation rule created successfully'
        };
    }

    /**
     * Get room analytics
     */
    getRoomAnalytics(roomId, timeframe = 'hour') {
        const roomDevices = Array.from(this.devices.values())
            .filter(device => device.room === roomId);

        const analytics = {
            roomId,
            timeframe,
            devices: roomDevices,
            metrics: {
                temperature: this.getSensorData(roomId, 'temperature', timeframe),
                humidity: this.getSensorData(roomId, 'humidity', timeframe),
                occupancy: this.getOccupancyData(roomId, timeframe),
                energy: this.getEnergyData(roomId, timeframe),
                airQuality: this.getAirQualityData(roomId, timeframe)
            },
            insights: {
                comfort: this.calculateComfortIndex(roomId),
                efficiency: this.calculateEfficiency(roomId),
                utilization: this.calculateUtilization(roomId)
            },
            recommendations: this.generateRoomRecommendations(roomId)
        };

        return analytics;
    }

    /**
     * Get campus-wide IoT analytics
     */
    getCampusAnalytics(timeframe = 'day') {
        const analytics = {
            timeframe,
            overview: {
                totalDevices: this.devices.size,
                onlineDevices: Array.from(this.devices.values()).filter(d => d.status === 'online').length,
                offlineDevices: Array.from(this.devices.values()).filter(d => d.status === 'offline').length,
                activeAutomations: Array.from(this.automations.values()).filter(a => a.enabled).length,
                totalAlerts: this.alerts.length
            },
            byBuilding: this.getBuildingAnalytics(timeframe),
            byDeviceType: this.getDeviceTypeAnalytics(timeframe),
            energy: {
                totalConsumption: this.getTotalEnergyConsumption(timeframe),
                cost: this.calculateEnergyCost(timeframe),
                savings: this.calculateEnergySavings(timeframe)
            },
            environmental: {
                temperature: this.getCampusTemperatureData(timeframe),
                humidity: this.getCampusHumidityData(timeframe),
                airQuality: this.getCampusAirQualityData(timeframe)
            },
            alerts: this.getRecentAlerts(timeframe),
            recommendations: this.generateCampusRecommendations()
        };

        return analytics;
    }

    /**
     * Update device status
     */
    updateDeviceStatus(deviceId, sensorType, data) {
        let device = this.devices.get(deviceId);
        if (!device) {
            // Auto-register unknown device
            device = {
                id: deviceId,
                name: `Device ${deviceId}`,
                type: 'unknown',
                status: 'online',
                lastSeen: new Date()
            };
            this.devices.set(deviceId, device);
        }

        device.status = 'online';
        device.lastSeen = new Date();

        // Update sensor data
        if (!this.sensors.has(deviceId)) {
            this.sensors.set(deviceId, {});
        }
        this.sensors.get(deviceId)[sensorType] = {
            ...data,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Check for alerts
     */
    checkForAlerts(deviceId, sensorType, data) {
        const alert = this.evaluateAlertConditions(deviceId, sensorType, data);
        if (alert) {
            alert.id = this.generateAlertId();
            alert.timestamp = new Date().toISOString();
            alert.deviceId = deviceId;
            alert.sensorType = sensorType;
            
            this.alerts.push(alert);
            
            // Emit alert event
            this.emit('alert', alert);
            
            // Send alert notification
            this.sendAlertNotification(alert);
            
            console.log(`🚨 IoT Alert: ${alert.message}`);
        }
    }

    /**
     * Evaluate alert conditions
     */
    evaluateAlertConditions(deviceId, sensorType, data) {
        const conditions = {
            temperature: {
                high: data.value > 30,
                low: data.value < 15,
                rapid_change: Math.abs(data.rateOfChange) > 5
            },
            humidity: {
                high: data.value > 80,
                low: data.value < 30
            },
            motion: {
                unexpected_hours: this.isUnexpectedMotionTime(deviceId),
                no_motion_extended: this.isNoMotionExtended(deviceId)
            },
            door: {
                forced_open: data.forced === true,
                open_too_long: data.openDuration > 300000 // 5 minutes
            },
            energy: {
                spike: data.consumption > data.baseline * 1.5,
                unusual_pattern: this.isUnusualEnergyPattern(deviceId, data)
            }
        };

        const deviceConditions = conditions[sensorType];
        if (!deviceConditions) return null;

        for (const [condition, triggered] of Object.entries(deviceConditions)) {
            if (triggered) {
                return {
                    type: sensorType,
                    severity: this.getAlertSeverity(condition),
                    condition,
                    message: this.generateAlertMessage(deviceId, sensorType, condition, data),
                    data
                };
            }
        }

        return null;
    }

    /**
     * Process automations
     */
    processAutomations(deviceId, sensorType, data) {
        this.automations.forEach((automation, id) => {
            if (!automation.enabled) return;

            automation.triggers.forEach(trigger => {
                if (this.evaluateTrigger(trigger, deviceId, sensorType, data)) {
                    this.executeAutomationActions(automation.actions, deviceId, data);
                    
                    automation.lastTriggered = new Date().toISOString();
                    automation.triggerCount++;
                }
            });
        });
    }

    /**
     * Execute automation actions
     */
    executeAutomationActions(actions, deviceId, triggerData) {
        actions.forEach(action => {
            switch (action.type) {
                case 'device_control':
                    this.controlDevice(action.deviceId, action.command, action.parameters);
                    break;
                case 'notification':
                    this.sendAutomationNotification(action, deviceId, triggerData);
                    break;
                case 'data_logging':
                    this.logAutomationData(action, deviceId, triggerData);
                    break;
                case 'scene_activation':
                    this.activateScene(action.sceneId);
                    break;
            }
        });
    }

    /**
     * Helper methods
     */
    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateAutomationId() {
        return 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateAlertId() {
        return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    broadcastToWebSocket(data) {
        if (this.wsServer) {
            this.wsServer.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    }

    sendDeviceConfiguration(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;

        const config = {
            deviceId,
            reportingInterval: 30000, // 30 seconds
            thresholds: {
                temperature: { min: 15, max: 30 },
                humidity: { min: 30, max: 80 }
            },
            features: device.capabilities
        };

        const topic = `smartcampus/${deviceId}/config`;
        this.mqttClient.publish(topic, JSON.stringify(config));
    }

    getAlertSeverity(condition) {
        const severityMap = {
            high: ['high', 'forced_open', 'spike'],
            medium: ['rapid_change', 'open_too_long'],
            low: ['low', 'unexpected_hours', 'no_motion_extended', 'unusual_pattern']
        };
        
        for (const [severity, conditions] of Object.entries(severityMap)) {
            if (conditions.includes(condition)) {
                return severity;
            }
        }
        return 'medium';
    }

    generateAlertMessage(deviceId, sensorType, condition, data) {
        const messages = {
            temperature_high: `Temperature too high in ${deviceId}: ${data.value}°C`,
            temperature_low: `Temperature too low in ${deviceId}: ${data.value}°C`,
            humidity_high: `Humidity too high in ${deviceId}: ${data.value}%`,
            humidity_low: `Humidity too low in ${deviceId}: ${data.value}%`,
            motion_unexpected: `Unexpected motion detected in ${deviceId}`,
            door_forced_open: `Forced entry detected at ${deviceId}`,
            energy_spike: `Energy consumption spike detected at ${deviceId}`
        };
        
        return messages[`${sensorType}_${condition}` || `Alert condition ${condition} detected at ${deviceId}`;
    }

    sendAlertNotification(alert) {
        // Emit alert event for real-time notifications
        this.emit('notification', {
            type: 'iot_alert',
            title: 'IoT Alert',
            message: alert.message,
            severity: alert.severity,
            data: alert,
            timestamp: new Date().toISOString()
        });
    }

    // Additional helper methods for analytics and recommendations
    getSensorData(roomId, sensorType, timeframe) {
        // Simulated sensor data - in production, query database
        return {
            current: 22.5,
            average: 21.8,
            min: 18.2,
            max: 26.1,
            trend: 'stable'
        };
    }

    calculateComfortIndex(roomId) {
        const temp = this.getSensorData(roomId, 'temperature');
        const humidity = this.getSensorData(roomId, 'humidity');
        
        // Simplified comfort index calculation
        const comfortScore = 100 - Math.abs(temp.current - 22) - Math.abs(humidity.current - 50);
        
        return {
            score: Math.max(0, Math.min(100, comfortScore)),
            level: comfortScore > 80 ? 'excellent' : comfortScore > 60 ? 'good' : 'poor',
            factors: {
                temperature: temp.current,
                humidity: humidity.current
            }
        };
    }

    generateRoomRecommendations(roomId) {
        return [
            {
                type: 'comfort',
                priority: 'medium',
                message: 'Adjust temperature by 2°C for optimal comfort',
                action: 'hvac_control',
                parameters: { target: 24 }
            },
            {
                type: 'energy',
                priority: 'low',
                message: 'Turn off lights when room is unoccupied',
                action: 'automation',
                parameters: { trigger: 'no_motion', action: 'lights_off' }
            }
        ];
    }

    async startDeviceDiscovery() {
        console.log('🔍 Starting IoT device discovery...');
        // In production, implement actual device discovery protocol
    }

    async initializeAutomations() {
        console.log('⚙️ Initializing IoT automation rules...');
        // Load automation rules from database or configuration
    }
}

module.exports = IoTService;
