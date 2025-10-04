# FRONTEND.md

Frontend implementation guide for Level waveform visualizer.

## Stack

- Next.js 15.5.4 (App Router)
- TypeScript
- Tailwind CSS
- SVG-based waveform
- React hooks (state management allowed if needed)

## Visual Style

**Minimalist black & white:**
- Background: `#000000`
- Text: `#ffffff`
- Borders: `#333333`
- Waveform: White stroke
- Clean, no shadows, simple borders

## Structure

```
frontend/src/
├── app/
│   ├── page.tsx                 # Landing + upload
│   └── visualize/page.tsx       # Waveform view
├── components/
│   ├── FileUploader.tsx
│   ├── Waveform.tsx             # SVG smooth curve
│   ├── MetricsPanel.tsx
│   └── LoadingSpinner.tsx
└── types/
    └── index.ts
```

## Key Types

```typescript
interface ClusterPeak {
  id: number;
  x: number;              // 0-1 position
  amplitude: number;      // Current height
  originalAmplitude: number;
  label: string;          // Gemini description
  weight: number;
  sampleCount: number;
  samples: string[];
}

interface WaveformData {
  peaks: ClusterPeak[];
  metrics: {
    giniCoefficient: number;
    flatnessScore: number;
    totalPoints: number;
    clusterCount: number;
  };
}
```

## Waveform Implementation

**Smooth cubic Bezier curve connecting peaks:**

```typescript
function generateSmoothPath(peaks: ClusterPeak[], width: number, height: number): string {
  const points = peaks.map(p => ({
    x: p.x * width,
    y: (1 - p.amplitude) * height
  }));
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = (curr.x - prev.x) / 3;
    
    path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
  }
  
  return path;
}
```

## Interaction

- Drag peaks up/down to adjust amplitude
- Show percentage on hover
- Update backend on drag release
- Smooth visual transitions

## API Integration

```typescript
// Upload CSV
POST /api/upload → { dataset_id }

// Get waveform
GET /api/waveform/{id} → WaveformData

// Adjust weights
POST /api/adjust/{id} → Updated metrics

// Export
GET /api/export/{id} → Download CSV
```

## Keep It Simple

- Use native fetch
- Simple components, no libraries
- Desktop-first (responsive optional)
- Ship the demo