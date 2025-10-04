# PLAN.md

Implementation order and flow for Level.

## Implementation Order

### 1. Backend Services
Build in this order since each depends on the previous:

```
embedder.py → clusterer.py → analyzer.py → waveform.py → main.py
```

Test each service with a sample CSV before moving to the next.

### 2. Backend API
Wire up `main.py` with all endpoints. Test upload and waveform retrieval with curl.

### 3. Frontend Components
```
Types → FileUploader → Waveform (static) → Waveform (drag) → MetricsPanel → Pages
```

Build waveform without drag first, then add interaction.

### 4. Integration
Connect frontend to backend, wire up the full flow.

---

## User Flow

```
1. Land on homepage
   ↓
2. Upload CSV
   ↓
3. Backend processes:
   - Generate embeddings
   - Cluster data
   - Get Gemini descriptions
   - Build waveform
   ↓
4. Show waveform visualization
   - Smooth curve with peaks
   - Each peak labeled by Gemini
   ↓
5. User drags peaks up/down
   - Visual updates in real-time
   - Send adjustments to backend
   - Metrics recalculate
   ↓
6. Export balanced dataset
   - Download CSV with weight column
```

---

## Data Flow

```
CSV File
  ↓
Embeddings (1024-dim vectors)
  ↓
Clusters (DBSCAN labels)
  ↓
Descriptions (Gemini analysis)
  ↓
1D Positions (UMAP projection)
  ↓
Waveform Data (peaks with x, amplitude, label)
  ↓
Frontend Visualization
  ↓
User Adjustments
  ↓
Weighted Dataset
```

---

## Critical Path

**Must work for demo:**
- CSV upload → waveform appears
- Drag peak → amplitude changes
- Export → download with weights

**Everything else is polish.**