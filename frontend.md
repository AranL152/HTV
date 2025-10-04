# FRONTEND.md

Frontend implementation guide for Level.

## Overview

The frontend is a Next.js application that provides file upload, 3D terrain visualization, and interactive bias correction. Users drag hills up/down to adjust cluster weights and see real-time metrics updates.

**Core Responsibilities**:
- CSV file upload with preview
- 3D terrain rendering with Three.js
- Interactive hill dragging (adjust weights)
- Real-time metrics display
- Export balanced datasets

## Architecture

```
Next.js App Router
    ↓
Pages
├── / (landing)
├── /upload (file upload)
└── /visualize (3D terrain)
    ↓
Components
├── Upload (FileUploader)
├── Visualization (TerrainMap, Terrain, Hill, Stars)
└── Controls (DragControls, MetricsPanel, ClusterList)
    ↓
Hooks (useDataset, useTerrain, useDrag)
    ↓
API Client (fetch to backend)
```

## Project Structure

```
frontend/src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── upload/page.tsx       # Upload flow
│   └── visualize/page.tsx    # Main visualization
├── components/
│   ├── upload/
│   │   └── FileUploader.tsx  # Drag-drop CSV upload
│   ├── visualization/
│   │   ├── TerrainMap.tsx    # Three.js canvas container
│   │   ├── Terrain.tsx       # Ground mesh with displaced vertices
│   │   ├── Hill.tsx          # Cluster peak markers
│   │   └── Stars.tsx         # Background particle field
│   └── controls/
│       ├── DragControls.tsx  # Drag interaction logic
│       ├── MetricsPanel.tsx  # Statistics sidebar (left)
│       └── ClusterList.tsx   # Cluster legend (right)
├── hooks/
│   ├── useDataset.ts         # Fetch & poll dataset status
│   ├── useTerrain.ts         # Terrain state management
│   └── useDrag.ts            # Drag event handling
├── services/
│   └── api.ts                # Backend API client
└── types/
    └── terrain.ts            # TypeScript type definitions
```

## Key Type Definitions

### `types/terrain.ts`

```typescript
interface Hill {
  id: number;
  center: [number, number];      // X, Z position
  height: number;                // Current height
  originalHeight: number;        // Initial height
  radius: number;
  label: string;                 // Gemini description
  description?: string;
  weight: number;                // height / originalHeight
  color: string;
  sampleCount: number;
}

interface TerrainData {
  hills: Hill[];
  gridSize: number;
  heightData: number[][];        // 2D height grid
  metrics: BiasMetrics;
}

interface BiasMetrics {
  totalPoints: number;
  clusterCount: number;
  giniCoefficient: number;
  flatnessScore: number;         // 1 - gini
}
```

## Page Flow

### 1. Landing Page (`/`)
- Hero section with project description
- "Get Started" button → `/upload`
- Visual examples / demo video (optional)

### 2. Upload Page (`/upload`)
- **FileUploader** component
- Drag-drop CSV file
- Preview first 5 rows in table
- Column selection dropdown (choose text field)
- "Analyze Dataset" button
- On success: Navigate to `/visualize?id={dataset_id}`

### 3. Visualization Page (`/visualize`)
- Poll backend for processing status
- Show loading spinner with progress (0-100%)
- When complete: Render 3D terrain
- **TerrainMap** component (full screen)
- **MetricsPanel** (left sidebar)
- **ClusterList** (right sidebar)
- Export button (bottom right)

## Component Responsibilities

### Upload Components

**FileUploader**
- Drag-drop zone for CSV files
- File validation (size, type)
- Parse CSV with PapaParse (preview + column detection)
- Column selection dropdown
- Upload button with loading state
- Error handling and display

### Visualization Components

**TerrainMap** (Main Three.js Scene)
- Canvas with dark space background
- Star particle field (@react-three/drei Stars)
- Terrain mesh (ground plane with displaced vertices)
- Hill markers (cones/spheres at cluster centers)
- OrbitControls (camera manipulation)
- Lighting (directional + ambient)
- Manages drag state and interactions

**Terrain** (Ground Mesh)
- PlaneGeometry rotated horizontal
- Vertices displaced by heightData
- Red glossy material (metalness 0.6, roughness 0.3)
- Receives shadows
- Updates geometry when heightData changes

**Hill** (Cluster Marker)
- Cone mesh positioned at cluster center
- Color based on cluster
- Hover effects (scale up, glow)
- Click to start drag
- Tooltip showing label, height%, weight

**Stars** (Background)
- Particle field using @react-three/drei
- 5000+ white dots
- Depth fade effect
- Matches reference image aesthetic

### Control Components

**MetricsPanel** (Left Sidebar)
- Total data points
- Cluster count
- Gini coefficient (with gauge)
- Flatness score (0-100% progress bar)
- Per-cluster breakdown:
  - Color indicator
  - Label
  - Size
  - Current weight

**ClusterList** (Right Sidebar)
- Scrollable list of clusters
- Each cluster shows:
  - Color dot
  - Gemini-generated label + description
  - Data point count
  - Current weight (with color coding)
  - Action buttons:
    - "Focus" (camera zoom to hill)
    - "Reset" (restore original height)
    - "Flatten" (set weight to 0)

**DragControls** (Logic Hook)
- Not a visible component
- Handles mouse events during drag
- Calculates height delta from Y movement
- Updates terrain in real-time
- Sends final adjustment to backend on release

## Custom Hooks

### useDataset
**Purpose**: Fetch and poll dataset status

**Behavior**:
- Takes `datasetId` from URL params
- Polls `/api/status/{id}` every 2 seconds
- Updates local state with progress
- When status = `completed`: Fetch terrain data
- Returns: `{ dataset, loading, error }`

### useTerrain
**Purpose**: Manage terrain state

**Behavior**:
- Stores current terrain data
- `updateHillHeight(hillId, newHeight)` - Updates hill and regenerates heightData
- Regenerates terrain grid using Gaussian formula (client-side)
- Returns: `{ terrainData, updateHillHeight }`

### useDrag
**Purpose**: Handle drag interactions

**Behavior**:
- Tracks dragging state (`draggingHillId`, `dragStartY`, `originalHeight`)
- `startDrag(hillId, clientY, height)` - Begin drag
- Mouse move: Calculate height delta, update terrain
- Mouse up: Send final adjustment to backend
- Returns: `{ draggingHillId, startDrag }`

## Three.js Implementation

### Scene Setup
```
<Canvas camera={{ position: [0, 80, 100], fov: 50 }}>
  <Stars />
  <directionalLight position={[20, 30, 10]} castShadow />
  <ambientLight intensity={0.2} />
  <OrbitControls 
    maxPolarAngle={Math.PI / 2.1}  // Top-down constraint
    minPolarAngle={Math.PI / 6}
  />
  <Terrain heightData={...} />
  {hills.map(hill => <Hill key={hill.id} {...hill} />)}
</Canvas>
```

### Terrain Mesh Construction
1. Create PlaneGeometry (200x200 size, gridSize-1 segments)
2. Rotate -90° on X (horizontal)
3. Apply height data to vertex Y positions
4. Compute vertex normals (for lighting)
5. Set `needsUpdate = true` on position attribute
6. Material: Red MeshStandardMaterial with metalness/roughness

### Drag Interaction Flow
1. User clicks hill → `startDrag` called
2. Mouse moves → Track deltaY from start
3. Convert deltaY to height change (scale factor 0.05)
4. Call `updateHillHeight` → Regenerate terrain
5. Update mesh geometry (only modified vertices)
6. Mouse up → Send adjustment to `/api/adjust/{id}`
7. Receive updated metrics → Update UI

### Performance Optimizations
- Use BufferGeometry (not Geometry)
- Update only modified vertices during drag
- Throttle terrain updates to 60 FPS
- Dispose geometries/materials on unmount
- LOD for very large grids (100x100 is fine)

## API Client

### `services/api.ts`

**Methods**:
- `uploadFile(file, textColumn?)` → `{ dataset_id }`
- `getStatus(datasetId)` → `{ status, progress }`
- `getTerrain(datasetId)` → `TerrainData`
- `adjustWeights(datasetId, adjustments)` → `{ updated_metrics }`
- `getExportUrl(datasetId, format)` → URL string

**Error Handling**:
- Throw errors with descriptive messages
- Retry logic for transient failures (optional)
- Toast notifications for user-facing errors

## Styling

### Tailwind CSS
- Dark theme (gray-900, black backgrounds)
- Blue accent colors (buttons, highlights)
- Responsive layout (desktop-first, 1024px+)
- Utility classes only (no custom CSS)

### Color Scheme
- Background: `bg-gray-900`, `bg-black`
- Text: `text-white`, `text-gray-400`
- Accent: `bg-blue-600`, `hover:bg-blue-700`
- Success: `bg-green-600`
- Error: `bg-red-600`
- Terrain: Red gradient (#cc0000 to #ff4444)

## User Interactions

### Upload Flow
1. User drops CSV file → Preview appears
2. Select text column → "Analyze" button enabled
3. Click "Analyze" → Upload + navigate
4. Loading screen → Progress updates
5. Visualization loads

### Visualization Flow
1. View terrain landscape
2. Hover over hill → Tooltip appears
3. Click and drag hill down → Height decreases
4. Release → Metrics update
5. See flatness score improve
6. Click "Export" → Download balanced CSV

### Drag Mechanics
- **Click hill**: Start drag
- **Move up**: Increase height (max 200% original)
- **Move down**: Decrease height (min 0%)
- **Release**: Commit change
- **Visual feedback**: Real-time mesh deformation, height% overlay

## State Management

### No Global State Library
- Use React hooks (useState, useReducer)
- Props drilling for terrain data
- Context for theme (optional, not needed for MVP)

### State Location
- Dataset status: `useDataset` hook
- Terrain data: `useTerrain` hook
- Drag state: `useDrag` hook
- UI state: Local component state

## Error Handling

### Upload Errors
- File too large: Show error message
- Invalid CSV: Show parsing error
- Network failure: Show retry button

### Visualization Errors
- Dataset not found: Redirect to upload
- Processing failed: Show error + retry
- Three.js crash: Error boundary with fallback UI

### Drag Errors
- Backend unreachable: Local-only updates (warn user)
- Invalid adjustment: Revert to previous state

## Responsive Design

### Desktop (Primary Target)
- Full screen 3D visualization
- Sidebars: 320px width (left + right)
- Canvas: Remaining space

### Tablet (1024px+)
- Same layout as desktop
- Slightly narrower sidebars (280px)

### Mobile (Not Prioritized)
- Upload page works fine
- Visualization: Show message "Use desktop for best experience"

---

**For backend details, see BACKEND.md**
**For API contracts, see API.md**