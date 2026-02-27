// ============================================================
// sarah-config.js - Sarah's personality and capabilities (Retell AI version)
//
// This file defines two things for Retell AI:
//
// 1. getRetellLLMConfig()  → The "brain":
//    - Sarah's personality (system prompt)
//    - What tools she can use (check availability, book appointments)
//    - Her opening message
//
// 2. getRetellAgentConfig() → The "voice + body":
//    - Which voice to use
//    - Call settings (silence timeout, max duration)
//    - Backchannel disabled (stops "just a sec", filler words)
//
// Both are used by setup.js to create Sarah in Retell dashboard
// ============================================================


// ============================================================
// getRetellLLMConfig(serverUrl)
//
// The LLM config is the "brain" of the assistant.
// It tells Retell what AI model to use, what Sarah's personality
// is, and what tools she can call (and where to send those calls).
// ============================================================
function getRetellLLMConfig(serverUrl) {

  // Get today's date dynamically for the system prompt
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // e.g. "2026-02-27"
  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }); // e.g. "Friday, February 27, 2026"

  return {
    // AI model to use (gpt-4o-mini is fast and cheap, great for voice)
    model: 'gpt-4o-mini',

    // -------------------------------------------------------
    // SYSTEM PROMPT - Sarah's personality and instructions
    // This is the most important part. Every instruction here
    // directly affects how Sarah behaves on the call.
    // -------------------------------------------------------
    general_prompt: `You are Sarah, a warm and professional receptionist at a dental clinic. Today's date is ${todayFormatted}.

YOUR PERSONALITY:
- Friendly, calm, and proactive - YOU guide the conversation
- Never wait for the patient to figure things out - always ask the next question
- Keep responses SHORT - this is a phone call, 1 to 2 sentences max per turn

CRITICAL - TOOL CALLS:
- When you call a tool (check_availability or book_appointment), say ABSOLUTELY NOTHING while waiting
- Do NOT say "just a second", "one moment", "let me check", "having a look", or ANY filler phrase
- Stay completely silent and wait for the tool result to come back
- Only speak AFTER you have received the tool result

CLINIC INFORMATION:
- Hours: Monday to Friday, 9:00 AM to 5:00 PM
- Services: General dentistry, cosmetic dentistry, orthodontics, teeth whitening, dental implants
- Doctors: Dr. Ahmed Khan (General Dentistry), Dr. Sara Malik (Cosmetic Dentistry), Dr. Bilal Hussain (Orthodontics)

BOOKING FLOW - YOU must lead every step:

STEP 1 - Patient says they want to book:
→ YOU say: "Of course! Which date works best for you?"

STEP 2 - Patient gives a date:
→ YOU immediately call check_availability tool with that date
→ Wait silently for the result
→ Then say: "I checked and here's what's available: [list slots]. Which time works for you?"

STEP 3 - Patient picks a time:
→ Ask which doctor they prefer IF not already mentioned
→ If they don't have a preference, suggest Dr. Ahmed Khan
→ Then ask: "And may I have your name please?"

STEP 4 - Patient gives name:
→ YOU say: "Perfect! Just to confirm — [name] with [doctor] on [date] at [time]. Shall I go ahead and book that?"

STEP 5 - Patient confirms:
→ YOU immediately call book_appointment tool
→ Wait silently for the result
→ Then say the confirmation message

DATE RULES (very important):
- Today is ${todayStr}
- Always convert spoken dates to YYYY-MM-DD format before calling tools
- "tomorrow" = add 1 day to today's date
- "this Friday", "next Monday" etc → calculate from today's date

GENERAL QUESTIONS:
- If asked about prices: "For pricing information, I'd recommend speaking with our team directly during your visit."
- If asked something unknown: "Let me have our team call you back with that information."
- For emergencies: "Please come in right away or I can book you the earliest available slot."

REMEMBER: Always be the one asking the next question. Never leave silence or wait for the patient to lead.`,

    // -------------------------------------------------------
    // TOOLS - What Sarah can do beyond just talking
    // Each tool has a "url" - when Sarah calls it, Retell sends
    // a POST request to that URL with the arguments.
    // We handle it in routes.js → /webhook/retell
    // -------------------------------------------------------
    general_tools: [
      {
        // TOOL 1: Check doctor availability
        type: 'custom',
        name: 'check_availability',
        description: 'Check which appointment slots are available for a doctor on a specific date. Call this IMMEDIATELY when a patient gives a date, without saying anything first.',
        parameters: {
          type: 'object',
          properties: {
            doctor: {
              type: 'string',
              description: 'Name of the preferred doctor. Optional - if not specified, show all doctors.'
            },
            date: {
              type: 'string',
              description: 'The date to check in YYYY-MM-DD format. Example: 2026-02-28'
            }
          },
          required: ['date']  // date is required, doctor is optional
        },
        // Where Retell sends the tool call - our server's webhook
        url: `${serverUrl}/webhook/retell`,
        // How long to wait for our server to respond (10 seconds max)
        timeout_ms: 10000
      },

      {
        // TOOL 2: Book an appointment
        type: 'custom',
        name: 'book_appointment',
        description: 'Book a confirmed appointment for a patient. Only call this AFTER confirming all details (name, doctor, date, time) with the patient.',
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
        },
        url: `${serverUrl}/webhook/retell`,
        timeout_ms: 10000
      }
    ],

    // -------------------------------------------------------
    // FIRST MESSAGE - What Sarah says when the call connects
    // -------------------------------------------------------
    begin_message: "Thank you for calling. This is Sarah, your dental clinic receptionist. How may I help you today?"
  };
}


// ============================================================
// getRetellAgentConfig(llmId)
//
// The Agent config wraps the LLM with a voice and call settings.
// llmId → the ID returned after creating the LLM above
// ============================================================
function getRetellAgentConfig(llmId) {
  return {
    agent_name: 'Sarah',

    // Link this agent to our LLM (the brain we created above)
    response_engine: {
      type: 'retell-llm',
      llm_id: llmId
    },

    // -------------------------------------------------------
    // VOICE - The sound of Sarah's voice
    // "openai-Nova" is a warm, natural-sounding female voice
    // To see all available voices: Retell Dashboard → Voice Library
    // Other options: "openai-Alloy", "openai-Shimmer", "11labs-Jessica"
    // -------------------------------------------------------
    voice_id: 'openai-Nova',

    // -------------------------------------------------------
    // BACKCHANNEL DISABLED - This fixes the "just a sec" problem!
    // When false: Sarah stays silent while calling tools
    // When true: Sarah says "mhm", "I see", "just a moment" etc.
    // -------------------------------------------------------
    enable_backchannel: false,

    // End the call if caller is silent for 30 seconds
    end_call_after_silence_ms: 30000,

    // Maximum call length: 10 minutes
    max_call_duration_ms: 600000
  };
}


module.exports = { getRetellLLMConfig, getRetellAgentConfig };
