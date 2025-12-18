# Mayler PWA Authentication Fix Summary
**Problem:** The Google OAuth popup window was not opening when the app was installed/saved to the homepage (PWA mode) on mobile devices.
**Cause:** Mobile PWAs often block `window.open` popup calls or fail to handle them correctly in standalone mode.

## Fix Implementation
Modified `src/WebRTCApp.tsx` to detect PWA Standalone status.

### 1. Updated `triggerGoogleAuth`
- Added check for `(display-mode: standalone)`
- If detected, uses **Full Page Redirect** (`window.location.href`) instead of popup.
- Ensures the auth flow proceeds in the main window.

### 2. Updated `runTool` (`google_auth_setup`)
- Applied the same logic to the AI-triggered auth flow.
- Ensures voice commands like "Connect Google" also work in PWA mode.

### 3. Server Compatibility
- Verified `server.js` callback handler already supports redirecting back to the PWA app root (`/?auth_success=true`).

## Verification
- Build successful.
- TypeScript compilation passed.

## User Action Required
- You may need to **refresh the app** (pull down to refresh depending on device) or close and reopen it for the changes to take effect.
