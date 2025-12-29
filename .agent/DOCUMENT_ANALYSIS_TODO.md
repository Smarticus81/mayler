# 📸 Document Analysis - Completion Steps

## ✅ Completed
1. Backend vision route created (`backend/routes/vision.js`)
2. Camera capture component created (`src/components/CameraCapture.tsx`)
3. Camera capture styles added (`src/index.css`)

## 🔧 Remaining Steps

### Step 4: Add Tool to Toolkit

**File:** `src/hooks/useToolkit.ts`

**Add to toolkitDefinitions array (after web tools):**
```typescript
// Vision & Document Analysis
{ 
    type: 'function', 
    name: 'analyze_documents', 
    description: 'Analyzes uploaded images or documents using GPT-5.2 vision. Can analyze screenshots, photos of documents, diagrams, spreadsheets, receipts, contracts, etc. Supports multiple images at once.',
    parameters: { 
        type: 'object', 
        properties: { 
            images: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: 'Array of base64 encoded images to analyze' 
            }, 
            query: { 
                type: 'string', 
                description: 'What to analyze or extract. E.g., "Extract all text", "Summarize this document", "What are the key insights?", "Extract receipt total and items"' 
            } 
        }, 
        required: ['images', 'query'] 
    } 
},
```

**Add to switch statement (after web_search case):**
```typescript
case 'analyze_documents': {
    const resp = await fetch('/api/vision/analyze-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            images: a.images, 
            query: a.query 
        }),
    });
    return await safeJson(resp);
}
```

### Step 5: Mount Vision Router

**File:** `server.js`

**Add import:**
```javascript
import { createVisionRouter } from './backend/routes/vision.js';
```

**Add router initialization:**
```javascript
const visionRouter = createVisionRouter();
```

**Mount router:**
```javascript
app.use('/api/vision', visionRouter);
```

### Step 6: Add Camera Button to UI (Optional)

**File:** `src/layout/MainLayout.tsx`

**Add state:**
```typescript
const [showCamera, setShowCamera] = useState(false);
```

**Add import:**
```typescript
import { CameraCapture } from '../components/CameraCapture';
```

**Add button in status bar:**
```tsx
<button className="settings-btn" onClick={() => setShowCamera(true)}>
    📸
</button>
```

**Add camera modal:**
```tsx
{showCamera && (
    <CameraCapture 
        onCapture={(images) => {
            // Handle captured images
            console.log('Captured', images.length, 'images');
            setShowCamera(false);
        }}
        onClose={() => setShowCamera(false)}
    />
)}
```

### Step 7: Test

1. Restart servers
2. Click camera button
3. Allow camera permissions
4. Capture image(s)
5. Click "Analyze"
6. Check console for GPT-5.2 response

### Step 8: Commit

```bash
git add .
git commit -m "feat: Add document analysis with GPT-5.2 vision

- Created vision API route using GPT-5.2 Responses API
- Built camera capture component with mobile optimization
- Added image compression (1024px max, 80% quality)
- Support for multiple document analysis
- Mobile-first responsive design
- analyze_documents tool for agent

Features:
- Camera capture with preview
- Multi-image support
- Base64 encoding
- Cost optimization through compression
- Touch-friendly mobile UI
- GPT-5.2 vision analysis"

git push origin main
```

## Usage Example

**User:** "Hey Mayler, I want to show you a receipt"
**Agent:** Opens camera interface
**User:** Captures photo
**Agent:** Calls analyze_documents tool
**Result:** "This receipt from Whole Foods totals $47.32, dated 12/28/2025..."

## Notes

- GPT-5.2 uses Responses API (`/v1/responses`)
- Default reasoning effort: `none` (fast)
- Increase to `medium` or `high` for complex documents
- Images compressed to 1024px max dimension
- JPEG quality: 80% for cost optimization
- Supports multiple images per analysis
