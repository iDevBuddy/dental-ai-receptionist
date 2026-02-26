// ============================================================
// sarah-config.js - Sarah's personality and capabilities
//
// This file defines everything about the AI assistant:
// - Her name and voice
// - Her personality (system prompt)
// - What tools she can use (check availability, book appointments)
// - How calls start and end
//
// The serverUrl is your Railway deployment URL.
// Vapi will send tool call requests to: serverUrl/webhook/vapi
// ============================================================

function getSarahConfig(serverUrl) {
  return {

    // -------------------------------------------------------
    // BASIC INFO
    // -------------------------------------------------------
    name: 'Sarah',

    // -------------------------------------------------------
    // VOICE - "nova" is a warm, natural-sounding female voice
    // Other options: "alloy", "echo", "fable", "onyx", "shimmer"
    // -------------------------------------------------------
    voice: {
      provider: 'openai',
      voiceId: 'nova'
    },

    // -------------------------------------------------------
    // AI MODEL - The brain behind the conversation
    // -------------------------------------------------------
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',

      // Sarah's personality and instructions
      // This is the most important part - it defines how she behaves
      messages: [
        {
          role: 'system',
          content: `You are Sarah, a warm and professional receptionist at a dental clinic. Today's date is 2026-02-26.

YOUR PERSONALITY:
- Friendly, calm, and proactive - YOU guide the conversation
- Never wait for the patient to figure things out - always ask the next question
- Keep responses SHORT - this is a phone call, 1 to 2 sentences max per turn

CLINIC INFORMATION:
- Hours: Monday to Friday, 9:00 AM to 5:00 PM
- Services: General dentistry, cosmetic dentistry, orthodontics, teeth whitening, dental implants
- Doctors: Dr. Ahmed Khan (General Dentistry), Dr. Sara Malik (Cosmetic Dentistry), Dr. Bilal Hussain (Orthodontics)

BOOKING FLOW - YOU must lead every step:

STEP 1 - Patient says they want to book:
→ YOU say: "Of course! Which date works best for you?"

STEP 2 - Patient gives a date:
→ YOU immediately call check_availability tool with that date
→ Then say: "I checked and here's what's available: [list slots]. Which time works for you?"

STEP 3 - Patient picks a time:
→ Ask which doctor they prefer IF not already mentioned
→ If they don't have a preference, suggest Dr. Ahmed Khan
→ Then ask: "And may I have your name please?"

STEP 4 - Patient gives name:
→ YOU say: "Perfect! Just to confirm — [name] with [doctor] on [date] at [time]. Shall I go ahead and book that?"

STEP 5 - Patient confirms:
→ YOU immediately call book_appointment tool
→ Then say the confirmation message

DATE RULES (very important):
- Today is 2026-02-26 (Thursday)
- "tomorrow" = 2026-02-27
- "this Friday" = 2026-02-28
- "next Monday" = 2026-03-02
- Always convert spoken dates to YYYY-MM-DD format before calling tools

GENERAL QUESTIONS:
- If asked about prices: "For pricing information, I'd recommend speaking with our team directly during your visit."
- If asked something unknown: "Let me have our team call you back with that information."
- For emergencies: "Please come in right away or I can book you the earliest available slot."

REMEMBER: Always be the one asking the next question. Never leave silence or wait for the patient to lead.`
        }
      ],

      // -------------------------------------------------------
      // TOOLS - What Sarah can do beyond just talking
      // When she calls a tool, Vapi sends a request to our server
      // -------------------------------------------------------
      tools: [
        {
          // TOOL 1: Check doctor availability
          type: 'function',
          function: {
            name: 'check_availability',
            description: 'Check which appointment slots are available for a doctor on a specific date. Call this when a patient wants to know when they can book.',
            parameters: {
              type: 'object',
              properties: {
                doctor: {
                  type: 'string',
                  description: 'Name of the preferred doctor. Optional - if not specified, show all doctors.'
                },
                date: {
                  type: 'string',
                  description: 'The date to check, in YYYY-MM-DD format. Example: 2024-02-15'
                }
              },
              required: ['date']  // date is required, doctor is optional
            }
          },
          // Where Vapi sends the tool call request
          server: {
            url: `${serverUrl}/webhook/vapi`
          }
        },

        {
          // TOOL 2: Book an appointment
          type: 'function',
          function: {
            name: 'book_appointment',
            description: 'Book a confirmed appointment for a patient. Only call this AFTER confirming all details with the patient.',
            parameters: {
              type: 'object',
              properties: {
                patient_name: {
                  type: 'string',
                  description: 'Full name of the patient'
                },
                patient_phone: {
                  type: 'string',
                  description: 'Patient phone number (optional but helpful)'
                },
                doctor: {
                  type: 'string',
                  description: 'Full name of the doctor'
                },
                date: {
                  type: 'string',
                  description: 'Appointment date in YYYY-MM-DD format'
                },
                time: {
                  type: 'string',
                  description: 'Appointment time, e.g. "10:00 AM" or "02:00 PM"'
                }
              },
              required: ['patient_name', 'doctor', 'date', 'time']
            }
          },
          server: {
            url: `${serverUrl}/webhook/vapi`
          }
        }
      ]
    },

    // -------------------------------------------------------
    // FIRST MESSAGE - What Sarah says when the call connects
    // -------------------------------------------------------
    firstMessage: "Thank you for calling. This is Sarah, your dental clinic receptionist. How may I help you today?",

    // -------------------------------------------------------
    // CALL SETTINGS
    // -------------------------------------------------------

    // End the call if caller is silent for 30 seconds
    silenceTimeoutSeconds: 30,

    // Maximum call length: 10 minutes
    maxDurationSeconds: 600,

    // Message when call hits the time limit
    endCallMessage: "Thank you for calling. Have a wonderful day and we look forward to seeing you!",

    // Send all other events (call ended, etc.) to our server too
    server: {
      url: `${serverUrl}/webhook/vapi`
    }
  };
}

module.exports = { getSarahConfig };
