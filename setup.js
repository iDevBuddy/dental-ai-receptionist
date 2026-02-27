// ============================================================
// setup.js - One-time script to create Sarah in Retell AI
//
// Run this ONCE after deploying to Railway:
//   node setup.js
//
// What it does:
//   Step 1 → Creates the Retell LLM (the brain: prompt + tools)
//   Step 2 → Creates the Retell Agent (the voice that uses the brain)
//   Step 3 → Saves the Agent ID to your .env file automatically
//
// Prerequisites (fill these in .env first):
//   - RETELL_API_KEY  (from app.retellai.com → API Keys)
//   - SERVER_URL      (your Railway URL, e.g. https://yourapp.railway.app)
// ============================================================

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { getRetellLLMConfig, getRetellAgentConfig } = require('./sarah-config');

// Retell API base URL
const RETELL_API = 'https://api.retellai.com';

async function main() {
  console.log('');
  console.log('🚀 Creating Sarah assistant in Retell AI...');
  console.log('');

  // ---- Check that required .env variables are set ----
  if (!process.env.RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY is missing from your .env file');
    console.error('   Get it from: https://app.retellai.com → Settings → API Keys');
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

  // Standard headers for all Retell API calls
  const headers = {
    'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json'
  };

  console.log(`🌐 Server URL: ${process.env.SERVER_URL}`);
  console.log('');


  // ============================================================
  // STEP 1: Create the Retell LLM
  // This is the "brain" - it holds the system prompt and tools
  // ============================================================
  console.log('📝 Step 1: Creating LLM (brain + tools)...');

  let llmId;

  try {
    const llmConfig = getRetellLLMConfig(process.env.SERVER_URL);

    const llmResponse = await axios.post(
      `${RETELL_API}/create-retell-llm`,
      llmConfig,
      { headers }
    );

    llmId = llmResponse.data.llm_id;
    console.log(`   ✅ LLM created! ID: ${llmId}`);
    console.log('');

  } catch (error) {
    console.error('❌ Failed to create LLM');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }


  // ============================================================
  // STEP 2: Create the Retell Agent
  // This is the "voice" - it uses the LLM we just created
  // ============================================================
  console.log('🎙️  Step 2: Creating Agent (voice + call settings)...');

  let agentId;

  try {
    const agentConfig = getRetellAgentConfig(llmId);

    const agentResponse = await axios.post(
      `${RETELL_API}/create-agent`,
      agentConfig,
      { headers }
    );

    agentId = agentResponse.data.agent_id;
    const agentName = agentResponse.data.agent_name;

    console.log(`   ✅ Agent created!`);
    console.log(`      Name:     ${agentName}`);
    console.log(`      Agent ID: ${agentId}`);
    console.log(`      LLM ID:   ${llmId}`);
    console.log('');

  } catch (error) {
    console.error('❌ Failed to create Agent');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }


  // ============================================================
  // STEP 3: Save the Agent ID to .env automatically
  // ============================================================
  console.log('💾 Step 3: Saving Agent ID to .env...');

  if (fs.existsSync('.env')) {
    let envContent = fs.readFileSync('.env', 'utf8');

    if (envContent.includes('RETELL_AGENT_ID=')) {
      // Update the existing line
      envContent = envContent.replace(
        /RETELL_AGENT_ID=.*/,
        `RETELL_AGENT_ID=${agentId}`
      );
    } else {
      // Add a new line
      envContent += `\nRETELL_AGENT_ID=${agentId}`;
    }

    fs.writeFileSync('.env', envContent);
    console.log(`   ✅ Saved RETELL_AGENT_ID to .env!`);
  } else {
    console.log(`   ⚠️  No .env file found. Save this manually:`);
    console.log(`      RETELL_AGENT_ID=${agentId}`);
  }

  console.log('');
  console.log('🎉 Setup complete! Sarah is ready in Retell AI.');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Go to https://app.retellai.com');
  console.log('   2. Click "Phone Numbers" in the sidebar');
  console.log('   3. Buy or import a phone number');
  console.log('   4. Click on your phone number → set Agent to "Sarah"');
  console.log('   5. Save → Then call the number to test!');
  console.log('');
  console.log('💡 Tip: Make sure your Railway server is running before calling!');
  console.log('');
}

main();
