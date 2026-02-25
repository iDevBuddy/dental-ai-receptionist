// ============================================================
// setup.js - One-time script to create Sarah in Vapi
//
// Run this ONCE after deploying to Railway:
//   node setup.js
//
// What it does:
// 1. Creates the Sarah AI assistant in your Vapi account
// 2. Saves the Assistant ID to your .env file automatically
//
// Prerequisites (fill these in .env first):
//   - VAPI_API_KEY
//   - VAPI_PHONE_NUMBER_ID
//   - SERVER_URL (your Railway URL, e.g. https://yourapp.railway.app)
// ============================================================

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { getSarahConfig } = require('./sarah-config');

async function main() {
  console.log('');
  console.log('🚀 Creating Sarah assistant in Vapi...');
  console.log('');

  // ---- Check that required .env variables are set ----
  if (!process.env.VAPI_API_KEY) {
    console.error('❌ VAPI_API_KEY is missing from your .env file');
    console.error('   Get it from: https://dashboard.vapi.ai/ → API Keys');
    process.exit(1);
  }

  if (!process.env.SERVER_URL) {
    console.error('❌ SERVER_URL is missing from your .env file');
    console.error('   Set it to your Railway URL, e.g: https://yourapp.railway.app');
    process.exit(1);
  }

  if (process.env.SERVER_URL.includes('your-app')) {
    console.error('❌ SERVER_URL still has the placeholder value');
    console.error('   Replace it with your real Railway URL');
    process.exit(1);
  }

  // ---- Build the assistant configuration ----
  const config = getSarahConfig(process.env.SERVER_URL);

  // If a phone number ID is set, attach it to the assistant
  if (process.env.VAPI_PHONE_NUMBER_ID) {
    config.phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    console.log(`📱 Phone number ID: ${process.env.VAPI_PHONE_NUMBER_ID}`);
  }

  console.log(`🌐 Server URL: ${process.env.SERVER_URL}`);
  console.log('');

  try {
    // ---- Call Vapi API to create the assistant ----
    const response = await axios.post(
      'https://api.vapi.ai/assistant',
      config,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const assistantId = response.data.id;
    const assistantName = response.data.name;

    console.log(`✅ Assistant created!`);
    console.log(`   Name: ${assistantName}`);
    console.log(`   ID:   ${assistantId}`);
    console.log('');

    // ---- Save Assistant ID to .env file automatically ----
    if (fs.existsSync('.env')) {
      let envContent = fs.readFileSync('.env', 'utf8');

      if (envContent.includes('VAPI_ASSISTANT_ID=')) {
        // Update the existing line
        envContent = envContent.replace(
          /VAPI_ASSISTANT_ID=.*/,
          `VAPI_ASSISTANT_ID=${assistantId}`
        );
      } else {
        // Add a new line
        envContent += `\nVAPI_ASSISTANT_ID=${assistantId}`;
      }

      fs.writeFileSync('.env', envContent);
      console.log('✅ Assistant ID saved to .env automatically!');
    } else {
      console.log(`⚠️  No .env file found. Save this manually: VAPI_ASSISTANT_ID=${assistantId}`);
    }

    console.log('');
    console.log('🎉 Setup complete! Sarah is ready.');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Go to https://dashboard.vapi.ai/');
    console.log('   2. Click "Phone Numbers" in the sidebar');
    console.log('   3. Select your phone number');
    console.log('   4. Under "Inbound Settings", select Sarah as the assistant');
    console.log('   5. Save → Then call the number to test!');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to create assistant');

    if (error.response) {
      // Vapi returned an error response
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }

    process.exit(1);
  }
}

main();
