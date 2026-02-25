// ============================================================
// index.js - Main entry point for the server
//
// This is the file that starts everything.
// Run it with: node index.js
// ============================================================

// Load all environment variables from the .env file
// This MUST be the very first line before anything else
require('dotenv').config();

const express = require('express');
const app = express();

// This middleware lets Express read JSON data from incoming requests
// Vapi sends JSON, so this is required
app.use(express.json());

// Import our webhook routes
const routes = require('./routes');

// Connect the routes to the app
app.use('/', routes);

// Simple health check route
// Visit: http://localhost:3000/ to confirm the server is running
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Dental AI Receptionist - Sarah is ready!',
    timestamp: new Date().toISOString()
  });
});

// Start the server
// Railway sets PORT automatically, locally we use 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('✅ Server started successfully!');
  console.log(`   Running on port: ${PORT}`);
  console.log(`   Health check:    http://localhost:${PORT}/`);
  console.log(`   Webhook URL:     http://localhost:${PORT}/webhook/vapi`);
  console.log('');
  console.log('🦷 Sarah is ready to answer calls!');
  console.log('');
});
