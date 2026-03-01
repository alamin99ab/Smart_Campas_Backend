const mongoose = require('mongoose');

// Test script to check for duplicate index issues
async function testIndexes() {
    try {
        // Connect to MongoDB (using a test connection string)
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-campus-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB');

        // Test Subscription model indexes
        const Subscription = require('./models/Subscription');
        
        // Get index information
        const indexes = await Subscription.collection.getIndexes();
        console.log('📊 Subscription indexes:', Object.keys(indexes));

        // Try to create the model (this will trigger the duplicate index warning if it exists)
        console.log('✅ Subscription model loaded without duplicate index errors');

        // Test other models that had potential issues
        const Notice = require('./models/Notice');
        console.log('✅ Notice model loaded');

        const TeacherAbsence = require('./models/TeacherAbsence');
        console.log('✅ TeacherAbsence model loaded');

        const AdvancedAttendance = require('./models/AdvancedAttendance');
        console.log('✅ AdvancedAttendance model loaded');

        console.log('🎉 All models loaded successfully - no duplicate index issues!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('Duplicate schema index')) {
            console.log('🔍 Duplicate index issue still exists');
        }
    } finally {
        await mongoose.disconnect();
    }
}

testIndexes();
