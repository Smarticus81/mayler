# 🔍 Tool Call Logging Guide

## Overview
Comprehensive logging has been added to track all agent tool calls and verify when the agent is actually accessing your emails vs. fabricating responses.

## Where to Look

### 1. **Browser Console** (Frontend Logging)
**How to Access:**
1. Open your browser (where Mayler is running)
2. Press `F12` or right-click → "Inspect"
3. Click the **Console** tab

**What You'll See:**

#### When Agent Receives a Function Call:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 AGENT FUNCTION CALL RECEIVED
Call ID: call_abc123
Function: get_emails
Raw Arguments: {"maxResults": 5}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### When Tool Executes:
```
══════════════════════════════════════════════════════════════
🔧 TOOL CALL: get_emails
📋 ARGUMENTS:
{
  "maxResults": 5
}
⏳ Executing...
✅ TOOL SUCCESS: get_emails
⏱️ Duration: 245.32ms
📤 RESULT:
{
  "emails": [
    {
      "id": "19b495ed68757ef4",
      "subject": "Re: Project Update",
      "from": "john@example.com",
      ...
    }
  ]
}
══════════════════════════════════════════════════════════════
```

### 2. **Server Terminal** (Backend Logging)
**Where:** The terminal running `node server.js`

**What You'll See:**

#### Email Fetch:
```
═══════════════════════════════════════════════════════════════
📧 [Gmail API] GET /emails - Fetching emails from Gmail
📋 Parameters: maxResults=5
═══════════════════════════════════════════════════════════════
✅ [Gmail API] Successfully fetched 5 emails
📬 Email subjects:
   1. Re: Project Update
   2. Meeting Tomorrow
   3. Invoice #12345
   4. Newsletter Update
   5. Team Standup Notes
═══════════════════════════════════════════════════════════════
```

#### Email Search:
```
═══════════════════════════════════════════════════════════════
🔍 [Gmail API] POST /search - Searching emails
📋 Query: "invoice", maxResults=5
═══════════════════════════════════════════════════════════════
✅ [Gmail API] Search returned 3 results
📬 Search results:
   1. Invoice #12345
   2. Invoice #12344
   3. RE: Invoice Question
═══════════════════════════════════════════════════════════════
```

#### Email Send:
```
═══════════════════════════════════════════════════════════════
📤 [Gmail API] POST /send - Sending email
📋 To: john@example.com, Subject: "Follow up"
═══════════════════════════════════════════════════════════════
✅ [Gmail API] Email sent successfully
═══════════════════════════════════════════════════════════════
```

## How to Detect Fabrication

### ❌ **Agent is FABRICATING if:**
1. You ask "What emails do I have?"
2. Agent responds with email details
3. **NO LOGS appear in browser console or server terminal**

### ✅ **Agent is USING REAL DATA if:**
1. You ask "What emails do I have?"
2. You see the logging sequence:
   - `📡 AGENT FUNCTION CALL RECEIVED` (browser)
   - `🔧 TOOL CALL: get_emails` (browser)
   - `📧 [Gmail API] GET /emails` (server)
   - `✅ [Gmail API] Successfully fetched X emails` (server)
   - `📤 RESULT:` with actual email data (browser)
3. Agent responds with information matching the logged data

## Testing the Logging

### Test 1: Ask About Emails
**Say:** "Hey Mayler, what emails do I have?"

**Expected Logs:**
- Browser: `📡 AGENT FUNCTION CALL RECEIVED` → `get_emails`
- Server: `📧 [Gmail API] GET /emails`
- Browser: `📤 RESULT:` with email array

### Test 2: Search Emails
**Say:** "Search my emails for invoice"

**Expected Logs:**
- Browser: `📡 AGENT FUNCTION CALL RECEIVED` → `search_emails`
- Server: `🔍 [Gmail API] POST /search`
- Browser: `📤 RESULT:` with search results

### Test 3: Send Email
**Say:** "Send an email to john@example.com saying hello"

**Expected Logs:**
- Browser: `📡 AGENT FUNCTION CALL RECEIVED` → `send_email`
- Server: `📤 [Gmail API] POST /send`
- Browser: `📤 RESULT:` with success confirmation

## Color Coding

The logs use color coding for easy scanning:

- 🟢 **Green** (`✅`) = Success
- 🔴 **Red** (`❌`) = Error/Failure
- 🟡 **Yellow** (`📋`) = Parameters/Arguments
- 🔵 **Blue** (`📤`) = Results/Output
- 🟣 **Purple** (`📡`) = Agent function calls
- 🟢 **Cyan** (`🔧`) = Tool execution

## Troubleshooting

### "I don't see any logs"
1. Make sure browser console is open (F12)
2. Clear console and try again
3. Check that both servers are running:
   - `node server.js` on port 3000
   - `npm run dev` on port 5173

### "Agent responds but no logs appear"
**This means the agent is fabricating!** The agent should ALWAYS call tools before responding about emails.

### "Logs show errors"
Check the error message:
- `Gmail not authenticated` → Need to connect Google account in Settings
- `Query required` → Agent didn't provide required parameters
- Other errors → Check server terminal for details

## Files Modified

1. **Frontend:**
   - `src/hooks/useToolkit.ts` - Tool execution logging
   - `src/hooks/useWebRTC.ts` - Function call reception logging

2. **Backend:**
   - `backend/routes/gmail.js` - Gmail API operation logging

## Next Steps

If you notice the agent fabricating (responding without logs), you can:
1. Interrupt and say "Please use the get_emails tool first"
2. Report the issue - the logs will show exactly what happened
3. Consider adjusting the agent's system instructions to be more strict about tool usage
