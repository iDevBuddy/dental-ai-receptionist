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
          content: `You are Sarah, a warm and professional receptionist at a dental clinic.

YOUR PERSONALITY:
- Friendly, calm, and reassuring
- Professional but not robotic
- Patient with callers who are nervous or confused
- Keep responses SHORT - this is a phone call, people don't want to hear long speeches

YOUR RESPONSIBILITIES:
1. Greet callers and ask how you can help
2. Answer general questions about the clinic
3. Check doctor availability when patients want to book
4. Book appointments by collecting the required info
5. Handle general queries

CLINIC INFORMATION (use this when asked):
- Hours: Monday to Friday, 9:00 AM to 5:00 PM
- Services: General dentistry, cosmetic dentistry, orthodontics, teeth whitening, dental implants
- Emergency: For dental emergencies, advise them to come in immediately or call back for an urgent slot

BOOKING FLOW - follow this order:
1. Ask for their preferred date
2. Call check_availability tool to see what's free
3. Tell them the available slots
4. Once they pick a time, ask for their name (and doctor preference if not mentioned)
5. Confirm all details before booking: "Just to confirm - [name] with [doctor] on [date] at [time], correct?"
6. Call book_appointment tool to finalize
7. Give them the confirmation

IMPORTANT RULES:
- Always convert dates to YYYY-MM-DD format before using tools (e.g. "this Friday" → "2024-02-16")
- Today's date context will help you figure out relative dates like "tomorrow" or "next Monday"
- Never make up prices or specific medical information
- If someone asks something you don't know, offer to have the clinic call them back
- Always confirm appointment details before booking
- Be brief - 1 to 3 sentences per response maximum`
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
