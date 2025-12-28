# 🚀 Mayler Enhancement Implementation Plan

## Overview
Major enhancements to make Mayler more proactive, capable, and user-friendly.

---

## 1. ✅ Wake Word Return & Shutdown Logic

### Requirements:
- **"goodbye"/"bye"/"that's all for now"** → Return to wake word mode
- **Auto-shutdown** after 1 minute of no wake word detection
- **"shut down"/"stop listening"** → Complete shutdown

### Implementation:
- [ ] Add termination phrase detection in agent instructions
- [ ] Implement wake word mode transition logic
- [ ] Add 1-minute timeout timer
- [ ] Add complete shutdown handler
- [ ] Update UI to show wake word mode vs shutdown state

**Files to modify:**
- `src/hooks/useWebRTC.ts` - Add termination detection
- `src/layout/MainLayout.tsx` - Handle mode transitions
- `src/context/MaylerContext.tsx` - Add shutdown state

---

## 2. 🛠️ Comprehensive Gmail Tools

### Current Gaps:
- ❌ Draft creation (sends instead of saving)
- ❌ Draft management (list, update, delete, send)
- ❌ Email forwarding
- ❌ Label management
- ❌ Attachment handling
- ❌ Thread operations

### Implementation:
- [ ] Add `create_draft` tool
- [ ] Add `list_drafts` tool
- [ ] Add `update_draft` tool
- [ ] Add `send_draft` tool
- [ ] Add `delete_draft` tool
- [ ] Add `forward_email` tool
- [ ] Add `get_labels` tool
- [ ] Add `create_label` tool
- [ ] Add `add_label_to_email` tool
- [ ] Add `remove_label_from_email` tool
- [ ] Add `get_attachments` tool
- [ ] Add `download_attachment` tool
- [ ] Add `get_thread` tool

**Files to modify:**
- `src/hooks/useToolkit.ts` - Add all missing tools
- `backend/gmail-service.js` - Already has draft methods, expose them
- `backend/routes/gmail.js` - Add missing routes

---

## 3. 🔄 Proactive Email Processing

### Requirements:
- Agent processes emails one after another automatically
- No "Is there anything else?" prompts
- Continuous workflow until user interrupts

### Implementation:
- [ ] Update agent instructions for proactive behavior
- [ ] Add email queue processing logic
- [ ] Remove permission-seeking phrases
- [ ] Add "processing next email" transitions

**Files to modify:**
- `src/hooks/useWebRTC.ts` - Update system instructions

---

## 4. 🎭 Agent Personality Enhancement

### Requirements:
- Professional caring enthusiasm
- Faster speech (speed: 1.2x)
- Never suggest user does tasks themselves
- Proactive problem-solving
- Conversational email discussion
- Provide insights, advocacy, novel proposals

### Implementation:
- [ ] Rewrite system instructions with new personality
- [ ] Increase TTS speed to 1.2x
- [ ] Add conversation context awareness
- [ ] Add analytical/advisory capabilities

**Files to modify:**
- `src/hooks/useWebRTC.ts` - System instructions
- `backend/routes/rime.js` - TTS speed adjustment

---

## 5. 🌊 Streaming Visual Alternative

### Requirements:
- Masterfully designed streaming visualization
- Alternative or replacement for orb
- Reflects audio/activity state

### Implementation:
- [ ] Design audio waveform visualizer
- [ ] Create particle system animation
- [ ] Add frequency spectrum analyzer
- [ ] Make toggleable with orb

**Files to create:**
- `src/components/StreamingVisual.tsx`
- `src/components/WaveformVisualizer.tsx`
- `src/components/ParticleField.tsx`

---

## 6. 🎨 Error Notifications

### Requirements:
- Fun animated popups/toasts for errors
- Tool call failures
- Token limits
- API errors
- Network issues

### Implementation:
- [ ] Create toast notification system
- [ ] Add error detection in toolkit
- [ ] Add error detection in WebRTC
- [ ] Design animated error components

**Files to create:**
- `src/components/Toast.tsx`
- `src/components/ErrorToast.tsx`
- `src/hooks/useToast.ts`

---

## 7. 🌐 Comprehensive Web Browsing

### Requirements:
- Full web browsing capability
- Extract content from any URL
- Search and navigate
- Gain insights from web content

### Implementation:
- [ ] Enhance `web_search` tool
- [ ] Add `browse_url` tool (fetch and parse)
- [ ] Add `extract_content` tool
- [ ] Add `scrape_data` tool
- [ ] Add Puppeteer/Playwright for dynamic content

**Files to modify:**
- `src/hooks/useToolkit.ts` - Add browsing tools
- `backend/routes/utility.js` - Add web scraping
- `backend/utility-service.js` - Implement scraping logic

---

## Implementation Priority

### Phase 1 (Critical - Do First):
1. ✅ Wake word return & shutdown logic
2. 🛠️ Complete Gmail tools (drafts, labels, etc.)
3. 🎭 Agent personality enhancement

### Phase 2 (High Priority):
4. 🔄 Proactive email processing
5. 🌐 Comprehensive web browsing

### Phase 3 (Polish):
6. 🌊 Streaming visual
7. 🎨 Error notifications

---

## Estimated Complexity

| Feature | Complexity | Time Estimate |
|---------|-----------|---------------|
| Wake word logic | Medium | 30 min |
| Gmail tools | High | 1-2 hours |
| Personality | Low | 15 min |
| Proactive processing | Medium | 30 min |
| Web browsing | High | 1 hour |
| Streaming visual | High | 1-2 hours |
| Error toasts | Medium | 45 min |

**Total:** ~5-7 hours of implementation

---

## Notes

- All changes should maintain backward compatibility
- Test each phase before moving to next
- Commit after each major feature
- Update documentation as we go
