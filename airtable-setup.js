// ============================================================
// airtable-setup.js - Auto-creates Airtable tables + sample data
//
// Run this ONCE before starting the server:
//   node airtable-setup.js
//
// What it creates:
// 1. "Doctors" table with 4 fields + 3 sample doctors
// 2. "Appointments" table with 7 fields (starts empty)
//
// Prerequisites (fill these in .env first):
//   - AIRTABLE_API_KEY (needs schema.bases:write scope)
//   - AIRTABLE_BASE_ID
// ============================================================

require('dotenv').config();
const axios = require('axios');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;

// Standard headers for all Airtable API requests
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};


// ============================================================
// Step 1: Create the Doctors table
// ============================================================
async function createDoctorsTable() {
  console.log('📋 Creating Doctors table...');

  const tableConfig = {
    name: 'Doctors',
    description: 'Doctors at the dental clinic with their schedules',
    fields: [
      {
        name: 'Name',
        type: 'singleLineText',
        description: 'Full name of the doctor, e.g. Dr. Ahmed Khan'
      },
      {
        name: 'Specialty',
        type: 'singleLineText',
        description: 'e.g. General Dentistry, Orthodontics, Cosmetic Dentistry'
      },
      {
        name: 'Available_Days',
        type: 'singleLineText',
        description: 'e.g. Monday to Friday, or Tuesday and Thursday'
      },
      {
        name: 'Available_Hours',
        type: 'singleLineText',
        description: 'e.g. 9:00 AM - 5:00 PM'
      }
    ]
  };

  const response = await axios.post(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
    tableConfig,
    { headers }
  );

  console.log('✅ Doctors table created!');
  return response.data.id;
}


// ============================================================
// Step 2: Create the Appointments table
// ============================================================
async function createAppointmentsTable() {
  console.log('📋 Creating Appointments table...');

  const tableConfig = {
    name: 'Appointments',
    description: 'Patient appointments booked by Sarah',
    fields: [
      {
        name: 'Patient_Name',
        type: 'singleLineText',
        description: 'Full name of the patient'
      },
      {
        name: 'Patient_Phone',
        type: 'singleLineText',
        description: 'Patient contact number'
      },
      {
        name: 'Doctor',
        type: 'singleLineText',
        description: 'Name of the doctor'
      },
      {
        name: 'Date',
        type: 'date',
        options: {
          dateFormat: { name: 'iso' }  // Stores as YYYY-MM-DD
        }
      },
      {
        name: 'Time',
        type: 'singleLineText',
        description: 'e.g. 10:00 AM'
      },
      {
        name: 'Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Confirmed', color: 'greenBright' },
            { name: 'Cancelled', color: 'redBright' }
          ]
        }
      },
      {
        name: 'Notes',
        type: 'multilineText',
        description: 'Any additional notes about the appointment'
      }
    ]
  };

  const response = await axios.post(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
    tableConfig,
    { headers }
  );

  console.log('✅ Appointments table created!');
  return response.data.id;
}


// ============================================================
// Step 3: Add 3 sample doctors to the Doctors table
// ============================================================
async function addSampleDoctors() {
  console.log('👨‍⚕️ Adding 3 sample doctors...');

  const records = [
    {
      fields: {
        Name: 'Dr. Ahmed Khan',
        Specialty: 'General Dentistry',
        Available_Days: 'Monday to Friday',
        Available_Hours: '9:00 AM - 5:00 PM'
      }
    },
    {
      fields: {
        Name: 'Dr. Sara Malik',
        Specialty: 'Cosmetic Dentistry',
        Available_Days: 'Monday, Wednesday, Friday',
        Available_Hours: '10:00 AM - 4:00 PM'
      }
    },
    {
      fields: {
        Name: 'Dr. Bilal Hussain',
        Specialty: 'Orthodontics',
        Available_Days: 'Tuesday and Thursday',
        Available_Hours: '11:00 AM - 6:00 PM'
      }
    }
  ];

  await axios.post(
    `https://api.airtable.com/v0/${BASE_ID}/Doctors`,
    { records },
    { headers }
  );

  console.log('✅ 3 sample doctors added!');
  console.log('   - Dr. Ahmed Khan (General Dentistry)');
  console.log('   - Dr. Sara Malik (Cosmetic Dentistry)');
  console.log('   - Dr. Bilal Hussain (Orthodontics)');
}


// ============================================================
// Main function - runs all steps in order
// ============================================================
async function main() {
  console.log('');
  console.log('🚀 Setting up Airtable for Dental AI Receptionist...');
  console.log('');

  // Validate environment variables
  if (!BASE_ID || BASE_ID === 'appXXXXXXXXXXXXXX') {
    console.error('❌ AIRTABLE_BASE_ID is missing or still has placeholder value');
    console.error('   Get it from your Airtable base URL: airtable.com/appXXXXXX/...');
    process.exit(1);
  }

  if (!API_KEY || API_KEY.includes('your_airtable')) {
    console.error('❌ AIRTABLE_API_KEY is missing or still has placeholder value');
    console.error('   Create a token at: https://airtable.com/create/tokens');
    console.error('   Required scopes: data.records:read, data.records:write, schema.bases:write');
    process.exit(1);
  }

  try {
    // Create both tables
    await createDoctorsTable();
    await createAppointmentsTable();

    // Add sample doctors
    await addSampleDoctors();

    console.log('');
    console.log('🎉 Airtable setup complete!');
    console.log('');
    console.log('📋 Next step: Run "node setup.js" to create Sarah in Vapi');
    console.log('   (Make sure SERVER_URL is set in .env first!)');
    console.log('');

  } catch (error) {
    // Handle "table already exists" gracefully
    const errMsg = error.response?.data?.error?.message || error.message || '';

    if (errMsg.toLowerCase().includes('already exists') ||
        error.response?.status === 422) {
      console.log('');
      console.log('ℹ️  One or more tables already exist. Skipping table creation.');

      // Still try to add sample doctors
      try {
        await addSampleDoctors();
        console.log('');
        console.log('✅ Sample doctors added to existing Doctors table!');
      } catch (e) {
        console.log('ℹ️  Sample doctors may already be there too - that is fine!');
      }

    } else {
      console.error('');
      console.error('❌ Setup failed:', errMsg);
      console.error('');
      console.error('Common issues:');
      console.error('  - Token missing "schema.bases:write" scope → recreate token with that scope');
      console.error('  - Wrong Base ID → double check the URL of your Airtable base');
      console.error('');
      console.error('Full error:', JSON.stringify(error.response?.data, null, 2));
      process.exit(1);
    }
  }
}

main();
