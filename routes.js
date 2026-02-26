// ============================================================
// routes.js - The brain of the server
//
// This file handles the /webhook/vapi endpoint.
// Vapi calls this URL when:
//   1. Sarah needs to check doctor availability
//   2. Sarah needs to book an appointment
//   3. A call ends (for logging)
//
// HOW TOOL CALLS WORK:
//   Patient says: "I want to book an appointment on Friday"
//   Sarah (AI) decides to call the "check_availability" tool
//   Vapi sends a POST request to /webhook/vapi
//   This file reads the request, calls Airtable, and returns the result
//   Vapi gives the result back to Sarah, who speaks it to the patient
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
    const slots = d.freeSlots.slice(0, 5).map(s => s.replace(':00', '').replace(' AM', ' AM').replace(' PM', ' PM'));
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
// POST /webhook/vapi
// The main webhook endpoint - Vapi sends everything here
// ============================================================
router.post('/webhook/vapi', async (req, res) => {
  const message = req.body.message;

  // If there's no message, something is wrong
  if (!message) {
    console.error('⚠️  Received request with no message body');
    return res.status(400).json({ error: 'No message provided' });
  }

  console.log(`\n📞 Vapi event received: "${message.type}"`);

  // ============================================================
  // HANDLE TOOL CALLS
  // This is the main event - when Sarah needs data from us
  // ============================================================
  if (message.type === 'tool-calls') {
    const toolCallList = message.toolCallList || [];
    const results = [];

    // Loop through each tool call (usually just one at a time)
    for (const toolCall of toolCallList) {
      const toolName = toolCall.function.name;

      // Parse the arguments Sarah sent us
      // Arguments come as a JSON string, so we parse them
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch (e) {
        args = {};
      }

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

      // Add result to our response list
      results.push({
        toolCallId: toolCall.id,  // Must match the incoming tool call ID
        result: result
      });
    }

    // Send all results back to Vapi
    return res.json({ results });
  }


  // ============================================================
  // HANDLE END OF CALL REPORT
  // Triggered when the call ends - good for logging/analytics
  // ============================================================
  if (message.type === 'end-of-call-report') {
    const duration = message.durationSeconds || 0;
    const summary = message.summary || 'No summary available';
    const callId = message.call?.id || 'unknown';

    console.log(`\n📊 Call ended`);
    console.log(`   Call ID:  ${callId}`);
    console.log(`   Duration: ${duration} seconds`);
    console.log(`   Summary:  ${summary}`);

    return res.json({ received: true });
  }


  // For any other event type, just acknowledge it
  console.log(`   (No handler for this event type, acknowledging)`);
  res.json({ received: true });
});


// ============================================================
// handleCheckAvailability({ doctor, date })
//
// 1. Gets all doctors from Airtable
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
