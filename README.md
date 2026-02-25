# 🦷 Dental AI Receptionist - Sarah

Sarah is an AI voice receptionist for a dental clinic. She picks up phone calls, answers patient questions, checks doctor availability, and books appointments automatically.

---

## ✅ Complete Setup Guide (Follow in Order)

### STEP 1 — Install dependencies
Open terminal in this folder and run:
```
npm install
```

---

### STEP 2 — Create your .env file
Copy the example file:
```
copy .env.example .env
```
Then open `.env` and fill in all your keys. See the comments in the file for where to get each key.

**Keys you need:**
| Key | Where to get it |
|-----|----------------|
| VAPI_API_KEY | https://dashboard.vapi.ai/ → API Keys |
| VAPI_PHONE_NUMBER_ID | Vapi Dashboard → Phone Numbers → click your number |
| OPENAI_API_KEY | https://platform.openai.com/api-keys |
| AIRTABLE_API_KEY | https://airtable.com/create/tokens (needs schema.bases:write scope) |
| AIRTABLE_BASE_ID | From your Airtable base URL: airtable.com/**appXXXXXX**/... |
| SERVER_URL | Your Railway URL (fill after Step 5) |

---

### STEP 3 — Set up Airtable (creates tables automatically)
```
node airtable-setup.js
```
This creates:
- `Doctors` table with 3 sample doctors
- `Appointments` table (starts empty)

---

### STEP 4 — Push to GitHub
1. Create a new repository on https://github.com
2. Run these commands:
```
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

### STEP 5 — Deploy to Railway (free hosting)
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Click "Deploy"
5. After deployment, go to Settings → Networking → Generate Domain
6. Copy your Railway URL (e.g. `https://yourapp.railway.app`)
7. Paste it into `.env` as `SERVER_URL=https://yourapp.railway.app`
8. Add all your .env variables in Railway: Settings → Variables → Add them all

---

### STEP 6 — Create Sarah in Vapi
Make sure SERVER_URL is set, then run:
```
node setup.js
```
This creates the AI assistant and saves the ID to your .env automatically.

---

### STEP 7 — Connect Sarah to your phone number
1. Go to https://dashboard.vapi.ai/
2. Click "Phone Numbers" in the sidebar
3. Select your phone number
4. Under "Inbound Settings", choose Sarah as the assistant
5. Save

---

### STEP 8 — Test!
Call your Vapi phone number. Sarah will answer!

Try saying:
- *"I'd like to book an appointment"*
- *"What are your clinic hours?"*
- *"Is Dr. Ahmed available this Friday?"*

Check your Airtable Appointments table to see bookings appear in real time.

---

## 📁 File Structure

```
├── index.js          - Starts the Express server
├── routes.js         - Handles Vapi webhook calls
├── airtable.js       - Reads/writes to Airtable
├── openai.js         - Formats responses into natural speech
├── sarah-config.js   - Sarah's voice, personality, and tools
├── setup.js          - Creates Sarah in Vapi (run once)
├── airtable-setup.js - Creates Airtable tables (run once)
├── .env.example      - Template for your .env file
├── .env              - Your real keys (never push to GitHub!)
└── Procfile          - Tells Railway how to start the server
```

---

## 🔧 Troubleshooting

**Sarah doesn't pick up calls?**
- Check that the phone number is linked to Sarah in Vapi dashboard

**"Cannot connect to database" errors?**
- Double check AIRTABLE_API_KEY and AIRTABLE_BASE_ID in Railway variables

**Bookings not appearing in Airtable?**
- Make sure your Railway URL is correct in SERVER_URL
- Check Railway logs for error messages

**setup.js fails?**
- Make sure SERVER_URL is set to your Railway URL (not localhost)
