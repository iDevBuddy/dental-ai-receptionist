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
const path = require('path');
const app = express();

// -------------------------------------------------------
// CORS - Allow any website to talk to this server
// This is needed so demo.html can call /start-call
// even when opened from a different domain or localhost
// -------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Handle preflight requests (browser sends OPTIONS before POST)
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// This middleware lets Express read JSON data from incoming requests
app.use(express.json());

// Import our webhook routes
const routes = require('./routes');

// Connect the routes to the app
app.use('/', routes);

// -------------------------------------------------------
// Serve demo.html at /demo
// Visit: https://your-railway-url.railway.app/demo
// -------------------------------------------------------
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo.html'));
});

// Simple health check route
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Dental AI Receptionist - Sarah is ready!',
    timestamp: new Date().toISOString()
  });
});

// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('✅ Server started successfully!');
  console.log(`   Running on port: ${PORT}`);
  console.log(`   Health check:    http://localhost:${PORT}/`);
  console.log(`   Demo page:       http://localhost:${PORT}/demo`);
  console.log(`   Webhook URL:     http://localhost:${PORT}/webhook/retell`);
  console.log('');
  console.log('🦷 Sarah is ready to answer calls!');
  console.log('');
});
