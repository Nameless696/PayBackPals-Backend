/**
 * PayBackPal — MongoDB Connection (Mongoose)
 */
const dns      = require('dns');
const mongoose = require('mongoose');

// Force Google DNS to fix ISP SRV-lookup failures (ISP blocks TCP DNS port 53)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 8 no longer needs useNewUrlParser / useUnifiedTopology
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`❌ MongoDB connection error: ${err.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
