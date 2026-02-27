// ============================================================
// routes.js - The brain of the server
//
// This file handles the /webhook/retell endpoint.
// Retell AI calls this URL when:
//   1. Sarah needs to check doctor availability  (tool_call_invocation)
//   2. Sarah needs to book an appointment        (tool_call_invocation)
//   3. A call ends                               (call_ended)
//
// HOW TOOL CALLS WORK:
//   Patient says: "I want to book an appointment on Friday"
//   Sarah (AI) decides to call the "check_availability" tool
//   Retell sends a POST request to /webhook/retell
//   This file reads the request, calls Airtable, and returns the result
//   Retell gives the result back to Sarah, who speaks it to the patient
// ============================================================

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Import Airtable functions (no OpenAI - we format responses directly for speed)
const { getDoctors, checkAppointments, bookAppointment } = require('./airtable');


// ============================================================
// POST /start-call
// Called by the demo website when user clicks "Talk to Sarah"
// Creates a Retell web call and returns the access token
// The browser uses this token to connect directly to Sarah
// ============================================================
router.post('/start-call', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.retellai.com/v2/create-web-call',
      { agent_id: process.env.RETELL_AGENT_ID },
      { headers: { 'Authorization': `Bearer ${process.env.RETELL_API_KEY}` } }
    );

    res.json({ accessToken: response.data.access_token });
  } catch (error) {
    console.error('❌ Failed to create web call:', error.response?.data || error.message);
    res.status(500).json({ error: 'Could not start call. Please try again.' });
  }
});


// ============================================================
// Fast response formatters - no OpenAI call, instant response
// ============================================================
function formatAvailabilityFast(availabilityData, date) {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const available = availabilityData.filter(d => d.freeSlots && d.freeSlots.length > 0);
  if (available.length === 0) {
    return `I'm sorry, there are no available slots on ${formattedDate}. Would you like to try a different date?`;
  }

  const parts = available.map(d => {
    const slots = d.freeSlots.slice(0, 5);
    return `${d.doctor} at ${slots.join(', ')}`;
  });

  return `On ${formattedDate} we have: ${parts.join('. ')}. Which time works best for you?`;
}

function formatConfirmationFast({ patientName, doctor, date, time }) {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return `Your appointment is confirmed! ${patientName}, you're booked with ${doctor} on ${formattedDate} at ${time}. We look forward to seeing you!`;
}


// ============================================================
// POST /webhook/retell
// The main webhook endpoint - Retell AI sends everything here
//
// Retell sends TWO types of requests to this URL:
//
// 1. TOOL CALLS (when Sarah needs data from Airtable):
//    { name: "check_availability", tool_call_id: "...", arguments: {...} }
//    NOTE: NO "event" field for tool calls!
//
// 2. CALL LIFECYCLE EVENTS (started, ended):
//    { event: "call_ended", call: { call_id, duration_ms, ... } }
// ============================================================
router.post('/webhook/retell', async (req, res) => {
  const body = req.body;

  // ============================================================
  // HANDLE TOOL CALLS
  // Retell sends "name" field when it's a tool call
  // ============================================================
  if (body.name) {
    const toolName    = body.name;
    const toolCallId  = body.tool_call_id;
    const args        = body.arguments || {};

    console.log(`\n🔧 Tool call: "${toolName}" | Args:`, args);

    let result = '';

    try {
      if (toolName === 'check_availability') {
        result = await handleCheckAvailability(args);

      } else if (toolName === 'book_appointment') {
        result = await handleBookAppointment(args);

      } else {
        console.warn(`⚠️  Unknown tool: ${toolName}`);
        result = 'I apologize, I could not process that request. Please try again.';
      }

    } catch (error) {
      console.error(`❌ Error in tool "${toolName}":`, error.message);
      result = 'I apologize, there was a technical issue. Let me transfer you to our staff.';
    }

    console.log(`✅ Returning result to Retell`);
    return res.json({
      tool_call_id: toolCallId,
      content: result
    });
  }


  // ============================================================
  // HANDLE CALL LIFECYCLE EVENTS
  // Retell sends "event" field for call started/ended
  // ============================================================
  const event = body.event;

  if (event === 'call_ended') {
    const call       = body.call || {};
    const durationSec = Math.round((call.duration_ms || 0) / 1000);
    console.log(`\n📊 Call ended | ID: ${call.call_id} | Duration: ${durationSec}s`);
    return res.json({ received: true });
  }

  if (event === 'call_started') {
    console.log(`\n📞 Call started: ${(body.call || {}).call_id}`);
    return res.json({ received: true });
  }

  // Anything else - just acknowledge
  res.json({ received: true });
});


// ============================================================
// handleCheckAvailability({ doctor, date })
//
// 1. Gets all doctors from Airtable (cached for 5 min)
// 2. Checks which slots are already booked on that date
// 3. Returns available time slots in natural language
// ============================================================
async function handleCheckAvailability({ doctor, date }) {
  // Validate we have a date
  if (!date) {
    return 'I need a date to check availability. Which date were you thinking?';
  }

  // Get all doctors from Airtable
  const allDoctors = await getDoctors();

  if (allDoctors.length === 0) {
    return 'I\'m sorry, I could not retrieve our doctor list right now. Please call back in a moment.';
  }

  // If the patient asked for a specific doctor, filter to that doctor
  // Otherwise, show all doctors
  let relevantDoctors = allDoctors;

  if (doctor) {
    relevantDoctors = allDoctors.filter(d =>
      d.name.toLowerCase().includes(doctor.toLowerCase())
    );

    // If we couldn't find the doctor they asked for, tell them
    if (relevantDoctors.length === 0) {
      const doctorNames = allDoctors.map(d => d.name).join(', ');
      return `I'm sorry, I couldn't find a doctor named ${doctor}. Our available doctors are: ${doctorNames}. Would you like to book with one of them?`;
    }
  }

  // Get already-booked appointments for this date
  const existingAppointments = await checkAppointments(date);

  // Standard time slots from 9 AM to 5 PM (every hour)
  const allTimeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM',
    '03:00 PM', '04:00 PM', '05:00 PM'
  ];

  // Build availability data for each doctor
  const availabilityData = [];

  for (const doc of relevantDoctors) {
    // Find which slots are already booked for this doctor on this date
    const bookedTimes = existingAppointments
      .filter(appt => appt.doctor.toLowerCase().includes(doc.name.toLowerCase()))
      .map(appt => appt.time);

    // Free slots = all slots minus booked ones
    const freeSlots = allTimeSlots.filter(slot => !bookedTimes.includes(slot));

    availabilityData.push({
      doctor: doc.name,
      specialty: doc.specialty,
      freeSlots: freeSlots
    });
  }

  // Format directly - no OpenAI call for speed
  return formatAvailabilityFast(availabilityData, date);
}


// ============================================================
// handleBookAppointment({ patient_name, patient_phone, doctor, date, time })
//
// 1. Checks the slot isn't already taken (double-booking protection)
// 2. Creates the appointment in Airtable
// 3. Returns a confirmation message
// ============================================================
async function handleBookAppointment({ patient_name, patient_phone, doctor, date, time }) {
  // Validate required fields
  if (!patient_name || !doctor || !date || !time) {
    return 'I need your name, preferred doctor, date, and time to book an appointment. Could you provide those details?';
  }

  // Double-check the slot isn't already taken
  // (someone else might have booked while we were talking)
  const existingAppointments = await checkAppointments(date);

  const isSlotTaken = existingAppointments.some(appt =>
    appt.doctor.toLowerCase().includes(doctor.toLowerCase()) &&
    appt.time === time &&
    appt.status !== 'Cancelled'
  );

  if (isSlotTaken) {
    return `I'm sorry, the ${time} slot with ${doctor} on ${date} was just taken. Would you like to choose a different time?`;
  }

  // Book the appointment in Airtable
  await bookAppointment({
    patientName: patient_name,
    patientPhone: patient_phone || 'Not provided',
    doctor: doctor,
    date: date,
    time: time
  });

  // Format confirmation directly - no OpenAI call for speed
  return formatConfirmationFast({ patientName: patient_name, doctor, date, time });
}


module.exports = router;
