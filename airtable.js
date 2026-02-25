// ============================================================
// airtable.js - All database operations
//
// This file handles:
// 1. Reading doctors from the Doctors table
// 2. Checking existing appointments for a date
// 3. Creating new appointment records
// ============================================================

const Airtable = require('airtable');

// Connect to Airtable using credentials from .env
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);


// ============================================================
// getDoctors()
// Reads all doctors from the Doctors table in Airtable
// Returns: array of doctor objects
// ============================================================
async function getDoctors() {
  const doctors = [];

  // .select() fetches records, .eachPage() loops through them
  await base('Doctors').select({
    view: 'Grid view'
  }).eachPage((records, fetchNextPage) => {
    records.forEach(record => {
      doctors.push({
        id: record.id,
        name: record.get('Name') || 'Unknown',
        specialty: record.get('Specialty') || 'General Dentistry',
        availableDays: record.get('Available_Days') || 'Monday to Friday',
        availableHours: record.get('Available_Hours') || '9:00 AM - 5:00 PM'
      });
    });
    fetchNextPage(); // Get next page if there are more records
  });

  console.log(`📋 Found ${doctors.length} doctors in Airtable`);
  return doctors;
}


// ============================================================
// checkAppointments(date)
// Gets all booked appointments for a specific date
// This lets us know which time slots are already taken
//
// date: string in YYYY-MM-DD format (e.g. "2024-02-15")
// Returns: array of appointment objects
// ============================================================
async function checkAppointments(date) {
  const appointments = [];

  // Airtable formula to filter by date
  // IS_SAME checks if the date field matches our date
  const filterFormula = `IS_SAME({Date}, DATETIME_PARSE('${date}'), 'day')`;

  await base('Appointments').select({
    filterByFormula: filterFormula
  }).eachPage((records, fetchNextPage) => {
    records.forEach(record => {
      appointments.push({
        id: record.id,
        patientName: record.get('Patient_Name') || '',
        doctor: record.get('Doctor') || '',
        date: record.get('Date') || '',
        time: record.get('Time') || '',
        status: record.get('Status') || 'Confirmed'
      });
    });
    fetchNextPage();
  });

  console.log(`📅 Found ${appointments.length} existing appointments on ${date}`);
  return appointments;
}


// ============================================================
// bookAppointment(details)
// Creates a new appointment record in the Appointments table
//
// details: { patientName, patientPhone, doctor, date, time }
// Returns: the created appointment object
// ============================================================
async function bookAppointment({ patientName, patientPhone, doctor, date, time }) {
  // Create the record in Airtable
  // Field names here must EXACTLY match your Airtable column names
  const record = await base('Appointments').create({
    'Patient_Name': patientName,
    'Patient_Phone': patientPhone || 'Not provided',
    'Doctor': doctor,
    'Date': date,           // Must be YYYY-MM-DD format
    'Time': time,
    'Status': 'Confirmed'   // Default status
  });

  console.log(`✅ Appointment booked! Record ID: ${record.id}`);

  return {
    id: record.id,
    patientName,
    doctor,
    date,
    time
  };
}


// Export functions so other files can use them
module.exports = { getDoctors, checkAppointments, bookAppointment };
