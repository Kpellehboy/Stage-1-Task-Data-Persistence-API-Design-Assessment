// api/index.js
const app = require('../src/app');
const connectDB = require('../src/config/db');

// Initialize database connection when the serverless function starts
let dbConnected = false;

module.exports = async (req, res) => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
  // Pass the request to our Express app
  return app(req, res);
};