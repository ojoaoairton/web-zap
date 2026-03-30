

## Plan: Production-Ready Chat with Auto-Start, Export, Tracking & UTM

### Overview
Upgrade the FlowChat app to production quality: auto-start the chat, use WhatsApp's real background image, add Meta Pixel tracking, UTM capture, webhook data structure, and a standalone HTML+JS export system.

---

### 1. Auto-Start Chat Flow
**File: `src/components/player/ChatPlayer.tsx`**
- Remove the "Iniciar" button from the header
- Add a `useEffect` that calls `runFlow()` automatically on mount with a short initial delay (~800ms)
- Keep the reset button for restarting

### 2. WhatsApp Background
**File: `src/index.css`**
- Update `.chat-bg-pattern` to use the real WhatsApp background image: `https://static.whatsapp.net/rsrc.php/v4/y1/r/a3pd-CgpXeU.png`
- Set background color to `#0B1014`
- Adjust CSS vars `--wa-chat-bg` to match `#0B1014`

### 3. UTM Capture System
**File: `src/lib/utm.ts` (new)**
- Parse `window.location.search` on load to extract `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Export a `getUtmParams()` function returning a record of captured UTMs
- Store in sessionStorage so they persist across the session

### 4. Meta Pixel Integration
**File: `src/lib/metaPixel.ts` (new)**
- Functions: `initPixel(pixelId)`, `trackEvent(eventName, data?)`
- Inject the Facebook Pixel base code into `<head>` dynamically
- Auto-fire `PageView` on init

**File: `src/components/player/ChatPlayer.tsx`**
- Fire `ViewContent` when flow starts
- Fire `Lead` when any `input` block is submitted
- Fire `InitiateCheckout` when a button with a purchase-related label is clicked (configurable)

**File: `src/components/builder/BuilderPanel.tsx`**
- Add a settings section with a Meta Pixel ID input field, stored in the flow JSON

### 5. Flow Types Update
**File: `src/types/flow.ts`**
- Add to `Flow` interface: `pixelId?: string`, `webhookUrl?: string`
- Add to `ButtonOption`: `trackEvent?: string` (for custom pixel events)
- Add to `FlowBlock`: `trackEvent?: string`

### 6. Webhook Data Structure
**File: `src/lib/webhook.ts` (new)**
- Function `buildWebhookPayload(variables, utms)` that assembles: `{ nome, email, telefone, respostas, utms, timestamp }`
- Function `sendWebhook(url, payload)` — POST to configured URL (prepared but not auto-called yet)
- Integrate at end of flow in ChatPlayer

### 7. Standalone Export System
**File: `src/components/builder/BuilderPanel.tsx`**
- Add "Export Standalone" button next to the existing JSON export
- Generate a single HTML file containing:
  - Inline CSS (WhatsApp-style theme)
  - Inline JS (minimal chat engine that processes the flow JSON)
  - The flow JSON embedded as a variable
  - Meta Pixel code if configured
  - UTM capture logic
- The exported file works independently on any domain

### 8. Builder Settings Panel
**File: `src/components/builder/BuilderPanel.tsx`**
- Add collapsible "Settings" section at top of builder with:
  - Meta Pixel ID input
  - Webhook URL input
  - These values are saved in the flow JSON and included in exports

### 9. Responsive Polish
- Ensure the player fills the screen properly on mobile
- Match the reference screenshots: dark header with avatar, status indicator, proper bubble spacing

---

### Technical Details

**Meta Pixel injection** will use dynamic script creation to avoid requiring any build-time dependency. The pixel ID comes from the flow config.

**Standalone export** generates a self-contained HTML string using template literals. It includes a minified version of the chat engine logic (processBlock loop, variable replacement, typing animation) and all WhatsApp styling inline. No external dependencies required.

**UTM params** are captured once on page load and attached to all webhook payloads and pixel events as custom data.

