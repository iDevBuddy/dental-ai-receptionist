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

// Import Airtable functions (no OpenAI - we format responses directly for speed)
const { getDoctors, checkAppointments, bookAppointment } = require('./airtable');


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
// Retell sends different "event" types:
//   - "tool_call_invocation" → Sarah wants data from us
//   - "call_ended"           → call finished, good for logging
//   - "call_started"         → call just connected
// ============================================================
router.post('/webhook/retell', async (req, res) => {
  const body = req.body;
  const event = body.event;

  // If there's no event, something is wrong
  if (!event) {
    console.error('⚠️  Received request with no event type');
    return res.status(400).json({ error: 'No event provided' });
  }

  console.log(`\n📞 Retell event received: "${event}"`);


  // ============================================================
  // HANDLE TOOL CALLS
  // This is the main event - when Sarah needs data from us
  // Retell sends ONE tool call at a time (unlike Vapi which batched them)
  // ============================================================
  if (event === 'tool_call_invocation') {
    const toolName = body.name;
    const toolCallId = body.tool_call_id;

    // Retell sends arguments as a plain object (already parsed - no JSON.parse needed)
    const args = body.arguments || {};

    console.log(`🔧 Tool: "${toolName}" | Args:`, args);

    let result = '';

    try {
      // Route to the correct handler based on tool name
      if (toolName === 'check_availability') {
        result = await handleCheckAvailability(args);

      } else if (toolName === 'book_appointment') {
        result = await handleBookAppointment(args);

      } else {
        // Unknown tool name
        console.warn(`⚠️  Unknown tool called: ${toolName}`);
        result = 'I apologize, I could not process that request. Please try again.';
      }

    } catch (error) {
      // Something went wrong - tell Sarah gracefully
      console.error(`❌ Error in tool "${toolName}":`, error.message);
      result = 'I apologize, there was a technical issue. Let me transfer you to our staff.';
    }

    // -------------------------------------------------------
    // Retell response format for tool calls:
    // { tool_call_id: "...", content: "the result string" }
    // -------------------------------------------------------
    console.log(`✅ Returning result to Retell`);
    return res.json({
      tool_call_id: toolCallId,
      content: result
    });
  }


  // ============================================================
  // HANDLE CALL ENDED
  // Triggered when the call ends - good for logging/analytics
  // ============================================================
  if (event === 'call_ended') {
    const call = body.call || {};
    const callId = call.call_id || 'unknown';
    const durationMs = call.duration_ms || 0;
    const durationSec = Math.round(durationMs / 1000);

    console.log(`\n📊 Call ended`);
    console.log(`   Call ID:  ${callId}`);
    console.log(`   Duration: ${durationSec} seconds`);

    return res.json({ received: true });
  }


  // ============================================================
  // HANDLE CALL STARTED
  // ============================================================
  if (event === 'call_started') {
    const call = body.call || {};
    console.log(`📞 New call started: ${call.call_id}`);
    return res.json({ received: true });
  }


  // For any other event type, just acknowledge it
  console.log(`   (No handler for event "${event}", acknowledging)`);
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
