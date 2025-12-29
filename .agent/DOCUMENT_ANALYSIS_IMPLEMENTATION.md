# 📸 Document Analysis Implementation - GPT-5.2

## Official Model Information (Dec 2025)

### **Correct Model to Use: `gpt-5.2`**

Based on official OpenAI documentation:
- ✅ Latest flagship model (released Dec 11, 2025)
- ✅ Enhanced multimodality—especially vision
- ✅ Best general-purpose model for complex tasks
- ✅ Improved spreadsheet understanding and creation
- ✅ Better tool calling and context management

### **API Endpoint**
**Use Responses API** (not Chat Completions) for best results:
- Endpoint: `https://api.openai.com/v1/responses`
- Supports passing chain of thought (CoT) between turns
- Better intelligence, fewer tokens, higher cache hit rates

### **Vision Capabilities**
GPT-5.2 supports:
- Base64 encoded images
- URL-based images
- Multiple images per request
- Document analysis and understanding
- Screenshot interpretation
- Technical diagram analysis

---

## Implementation for Mayler

### **1. Camera Capture Component**

```typescript
// src/components/CameraCapture.tsx
import { useRef, useState } from 'react';

export const CameraCapture = ({ onCapture }: { onCapture: (images: string[]) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captures, setCaptures] = useState<string[]>([]);

  const startCamera = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } // Use back camera on mobile
    });
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
    setStream(mediaStream);
  };

  const captureImage = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    setCaptures([...captures, base64]);
  };

  const stopCamera = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
  };

  return (
    <div className="camera-capture">
      <video ref={videoRef} autoPlay playsInline />
      <button onClick={startCamera}>Start Camera</button>
      <button onClick={captureImage}>Capture</button>
      <button onClick={stopCamera}>Stop</button>
      <button onClick={() => onCapture(captures)}>Analyze ({captures.length})</button>
    </div>
  );
};
```

### **2. Backend Vision Route**

```javascript
// backend/routes/vision.js
import express from 'express';
import OpenAI from 'openai';

export const createVisionRouter = () => {
    const router = express.Router();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    router.post('/analyze-documents', async (req, res) => {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('📸 [Vision API] Analyzing documents with GPT-5.2');
        console.log(`📋 Images: ${req.body.images?.length || 0}`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            const { images, query } = req.body;

            // Build content array with text + images
            const content = [
                { type: 'text', text: query || 'Analyze these documents and provide insights' }
            ];

            // Add all images
            images.forEach((base64Image: string) => {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`
                    }
                });
            });

            // Use Responses API (recommended for GPT-5.2)
            const response = await openai.responses.create({
                model: 'gpt-5.2',
                input: content,
                reasoning: {
                    effort: 'none' // Fast analysis; increase to 'medium' for complex docs
                },
                text: {
                    verbosity: 'medium' // Balanced output
                },
                max_output_tokens: 2000
            });

            console.log(`✅ [Vision API] Analysis complete`);
            console.log('═══════════════════════════════════════════════════════════════\n');

            res.json({
                success: true,
                analysis: response.text,
                reasoning_tokens: response.usage?.reasoning_tokens || 0,
                total_tokens: response.usage?.total_tokens || 0
            });

        } catch (error) {
            console.error('❌ [Vision API] Analysis failed:', error.message);
            console.log('═══════════════════════════════════════════════════════════════\n');
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
```

### **3. Frontend Tool Definition**

```typescript
// src/hooks/useToolkit.ts - Add to toolkitDefinitions

{
    type: 'function',
    name: 'analyze_documents',
    description: 'Analyzes uploaded images or documents using GPT-5.2 vision. Can analyze screenshots, photos of documents, diagrams, spreadsheets, etc. Supports multiple images.',
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
                description: 'What to analyze or extract from the documents. E.g., "Extract all text", "Summarize this document", "What are the key insights?"'
            }
        },
        required: ['images', 'query']
    }
}

// Add to switch statement
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

### **4. Mount Vision Router**

```javascript
// server.js
import { createVisionRouter } from './backend/routes/vision.js';

const visionRouter = createVisionRouter();
app.use('/api/vision', visionRouter);
```

---

## Usage Examples

### **Example 1: Analyze Receipt**
```
User: "Hey Mayler, I want to show you a receipt"
Agent: *Opens camera interface*
User: *Captures photo*
Agent: Calls analyze_documents({
  images: ["base64..."],
  query: "Extract the total amount, date, and items from this receipt"
})
```

### **Example 2: Multiple Documents**
```
User: "Analyze these contracts"
User: *Captures 3 pages*
Agent: Calls analyze_documents({
  images: ["base64_1", "base64_2", "base64_3"],
  query: "Summarize the key terms and identify any concerning clauses"
})
```

### **Example 3: Spreadsheet**
```
User: "Help me understand this spreadsheet"
User: *Captures screenshot*
Agent: Calls analyze_documents({
  images: ["base64..."],
  query: "Explain what this spreadsheet shows and identify trends"
})
```

---

## Key Features

### **Reasoning Effort Levels**
- `none` - Fast, low-latency (default)
- `low` - Basic reasoning
- `medium` - Balanced reasoning
- `high` - Deep reasoning
- `xhigh` - Maximum reasoning (GPT-5.2 only)

### **Verbosity Levels**
- `low` - Concise answers
- `medium` - Balanced (default)
- `high` - Detailed explanations

### **Best Practices**
1. Use `reasoning.effort: "none"` for simple document scans
2. Increase to `"medium"` or `"high"` for complex legal/financial docs
3. Use `verbosity: "low"` for quick summaries
4. Use `verbosity: "high"` for detailed analysis
5. Compress images to reduce token usage (JPEG 0.8 quality)
6. Limit to 5-10 images per request for best performance

---

## Mobile Optimization

### **Camera Considerations**
- Use `facingMode: 'environment'` for back camera
- Add `playsInline` to video element for iOS
- Provide clear capture button (touch-friendly)
- Show preview of captured images
- Allow retake/delete before analysis

### **UI Considerations**
- Full-screen camera view on mobile
- Large, touch-friendly buttons
- Visual feedback on capture
- Loading indicator during analysis
- Swipe to delete captured images

---

## Cost Optimization

### **Token Usage**
- Images use ~765 tokens per image (1024x1024)
- Smaller images use fewer tokens
- Reasoning tokens add to cost
- Use `reasoning.effort: "none"` when possible

### **Compression**
```javascript
// Compress to 800px max dimension
const maxDim = 800;
const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height, 1);
canvas.width *= scale;
canvas.height *= scale;
const base64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
```

---

## Error Handling

```javascript
try {
    const response = await openai.responses.create({...});
} catch (error) {
    if (error.code === 'invalid_image_format') {
        return { error: 'Invalid image format. Please use JPEG or PNG.' };
    }
    if (error.code === 'image_too_large') {
        return { error: 'Image too large. Please compress or resize.' };
    }
    throw error;
}
```

---

## Testing Checklist

- [ ] Camera opens on mobile and desktop
- [ ] Multiple images can be captured
- [ ] Images are properly base64 encoded
- [ ] Analysis returns meaningful insights
- [ ] Error handling works (invalid images, API errors)
- [ ] Mobile UI is touch-friendly
- [ ] Loading states are clear
- [ ] Results are displayed properly
- [ ] Agent can discuss analysis results
- [ ] Works with various document types (receipts, contracts, screenshots)
