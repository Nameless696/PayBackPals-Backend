const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const mongoose = require('mongoose');

console.log('Connecting with Google DNS...');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(() => { console.log('✅ Connected! Host:', mongoose.connection.host); process.exit(0); })
  .catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
