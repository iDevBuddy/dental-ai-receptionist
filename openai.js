// ============================================================
// openai.js - Format raw data into natural spoken responses
//
// When we get availability data from Airtable, it's just raw JSON.
// This file uses GPT-4o-mini to convert it into natural speech
// that Sarah can say on the phone.
// ============================================================

const OpenAI = require('openai');

// Initialize OpenAI client with our API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// ============================================================
// formatAvailability(availabilityData, date)
// Converts raw slot data into a natural spoken sentence
//
// Example input:  [{doctor: "Dr. Ahmed", freeSlots: ["10:00 AM", "2:00 PM"]}]
// Example output: "Dr. Ahmed has slots available at 10 AM and 2 PM on Monday."
// ============================================================
async function formatAvailability(availabilityData, date) {
  // Format the date to be more human-readable
  // "2024-02-15" becomes "Thursday, February 15, 2024"
  const dateObj = new Date(date + 'T00:00:00'); // Add time to avoid timezone issues
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // If no doctors have free slots, return a simple message
  const hasSlots = availabilityData.some(d => d.freeSlots && d.freeSlots.length > 0);
  if (!hasSlots) {
    return `I'm sorry, there are no available slots on ${formattedDate}. Would you like to try a different date?`;
  }

  // Build a text summary of the available data
  const dataText = availabilityData.map(d => {
    if (!d.freeSlots || d.freeSlots.length === 0) {
      return `${d.doctor} (${d.specialty}): fully booked on this date`;
    }
    return `${d.doctor} (${d.specialty}): available at ${d.freeSlots.join(', ')}`;
  }).join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a dental clinic receptionist speaking on the phone.
Convert the following availability information into a short, natural spoken response.
- Keep it under 2-3 sentences
- Sound warm and professional
- List times naturally (say "10 AM" not "10:00 AM")
- This will be spoken out loud, so no bullet points or special characters`
        },
        {
          role: 'user',
          content: `Date: ${formattedDate}\n\nAvailability:\n${dataText}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    return completion.choices[0].message.content;

  } catch (error) {
    // If OpenAI fails, return a simple fallback response
    console.error('OpenAI formatting error:', error.message);
    return `On ${formattedDate}, we have the following slots available: ${dataText}. Which time works best for you?`;
  }
}


// ============================================================
// formatBookingConfirmation(details)
// Creates a warm confirmation message after booking
//
// Example output: "Perfect! I've booked you in with Dr. Ahmed on
//                  Thursday, February 15th at 10 AM. We look forward
//                  to seeing you!"
// ============================================================
async function formatBookingConfirmation({ patientName, doctor, date, time }) {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a dental clinic receptionist confirming a booking on the phone.
Create a warm, professional confirmation.
Keep it to 2 sentences maximum. This is spoken out loud so keep it natural.`
        },
        {
          role: 'user',
          content: `Confirm this appointment:
Patient: ${patientName}
Doctor: ${doctor}
Date: ${formattedDate}
Time: ${time}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    return completion.choices[0].message.content;

  } catch (error) {
    // Simple fallback if OpenAI fails
    console.error('OpenAI confirmation error:', error.message);
    return `Your appointment with ${doctor} is confirmed for ${formattedDate} at ${time}. We look forward to seeing you, ${patientName}!`;
  }
}


// Export both functions
module.exports = { formatAvailability, formatBookingConfirmation };
