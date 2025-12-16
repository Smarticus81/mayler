# Mayler Redesign Implementation Plan

## Phase 1: Wake Word Flow & Logic ✓ (In Progress)

### Changes Made:
- ✓ Lowered wake word threshold from 0.6 to 0.4
- ✓ Added TERMINATION_WORDS array
- ✓ Added SHUTDOWN_WORDS array

### To Do:
1. Add voice selection state
2. Implement auto-start wake word detection on app load
3. Add termination word detection in transcript
4. Add shutdown word detection
5. Implement continuous listening mode
6. Update session instructions to handle termination

## Phase 2: Voice Configuration

### Available OpenAI Voices:
- alloy (default)
- echo
- fable
- onyx
- nova
- shimmer

### Settings UI Labels (Layman-friendly):
- "Voice Style" dropdown with descriptions:
  - Alloy: "Balanced and neutral"
  - Echo: "Warm and friendly"
  - Fable: "Expressive and dynamic"
  - Onyx: "Deep and authoritative"
  - Nova: "Bright and energetic"
  - Shimmer: "Soft and gentle"

## Phase 3: UI Redesign - Zen Aesthetic

### Color Palette:
- Background: Soft cream/beige (#F5F5F0)
- Primary: Muted sage green (#A8B5A0)
- Secondary: Soft lavender (#D4C5D8)
- Text: Warm gray (#4A4A4A)
- Accents: Soft gold (#D4AF37)

### Design Principles:
- No hard borders - use soft shadows instead
- Rounded corners (border-radius: 20px+)
- Glassmorphism effects
- Soft gradients
- Ample whitespace
- Gentle animations

### Components to Update:
- Main container background
- Zen orb styling
- Button styles (soft, pill-shaped)
- Settings panel
- Transcript area
- Status indicators

## Phase 4: Settings Panel Redesign

### Settings to Include:
1. Voice Style (dropdown)
2. Wake Word Detection (toggle) - "Always listen for 'Hey Mayler'"
3. Continuous Listening (toggle) - "Stay active after commands"
4. Google Account (connect button)

### Layout:
- Clean, spacious
- Clear section headers
- Toggle switches instead of checkboxes
- Descriptive help text under each option

## Implementation Order:
1. Add voice state and selection
2. Implement termination/shutdown detection
3. Fix wake word auto-start flow
4. Redesign CSS with zen aesthetic
5. Update settings panel UI
6. Test complete flow
