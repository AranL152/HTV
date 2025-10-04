# API.md

API specification and data contracts for Level.

## Base URL

```
Development: http://localhost:8000
Production: https://api.level.app (TBD)
```

## Authentication

**None required for MVP** (public demo)

Future: API key or JWT tokens

## Endpoints

### POST `/api/upload`

Upload CSV file for analysis.

**Request**:
```http
POST /api/upload HTTP/1.1
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="data.csv"
Content-Type: text/csv

[CSV file contents]
--boundary
Content-Disposition: form-data; name="text_column"

description
--boundary--
```

**Parameters**:
- `file` (required): CSV file (max 50MB)
- `text_column` (optional): Column name containing text data

**Response** (200 OK):
```json
{
  "dataset_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "row_count": 1250,
  "columns": ["id", "name", "description", "category"]
}
```

**Errors**:
- `400 Bad Request`: Invalid CSV, missing columns, dataset too small
- `413 Payload Too Large`: File exceeds 50MB
- `415 Unsupported Media Type`: Not a CSV file

---

### GET `/api/status/{dataset_id}`

Check processing status.

**Request**:
```http
GET /api/status/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**Response** (200 OK):
```json
{
  "status": "processing",
  "progress": 65,
  "stage": "analyzing",
  "message": "Generating cluster descriptions"
}
```

**Status Values**:
- `processing`: Currently being processed
- `completed`: Ready for visualization
- `failed`: Processing error occurred

**Stages**:
- `parsing` (0-10%): Reading CSV file
- `embedding` (10-40%): Generating embeddings
- `clustering` (40-60%): Finding clusters
- `analyzing` (60-80%): Gemini cluster analysis
- `building_terrain` (80-100%): Creating height map

**Errors**:
- `404 Not Found`: Dataset ID doesn't exist

---

### GET `/api/terrain/{dataset_id}`

Get terrain data for visualization.

**Request**:
```http
GET /api/terrain/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**Response** (200 OK):
```json
{
  "hills": [
    {
      "id": 0,
      "center": [12.3, -5.7],
      "height": 8.5,
      "originalHeight": 8.5,
      "radius": 10.2,
      "label": "Senior Engineering Roles",
      "description": "Positions requiring 10+ years of software engineering experience",
      "weight": 1.0,
      "color": "#FF6B6B",
      "sampleCount": 450,
      "samples": [
        "Senior Software Engineer with expertise in...",
        "Principal Engineer role focusing on...",
        "Lead Developer position for..."
      ]
    },
    {
      "id": 1,
      "center": [-8.1, 15.4],
      "height": 3.2,
      "originalHeight": 3.2,
      "radius": 6.8,
      "label": "Entry-Level Positions",
      "description": "Junior roles and internships for early-career professionals",
      "weight": 1.0,
      "color": "#4ECDC4",
      "sampleCount": 120,
      "samples": [...]
    }
  ],
  "gridSize": 100,
  "heightData": [
    [0.0, 0.1, 0.3, 0.5, ...],  // 100 values
    [0.1, 0.2, 0.4, 0.6, ...],  // 100 values
    ...  // 100 rows total
  ],
  "metrics": {
    "totalPoints": 1250,
    "clusterCount": 8,
    "giniCoefficient": 0.42,
    "flatnessScore": 0.58
  }
}
```

**Field Descriptions**:
- `hills[]`: Array of cluster metadata
  - `center`: [X, Z] position on terrain (-50 to 50 range)
  - `height`: Current height (adjustable, 0-20 range)
  - `originalHeight`: Initial height (cluster size normalized)
  - `radius`: Hill base radius (cluster spread)
  - `label`: Gemini-generated description
  - `weight`: Current sampling weight (height / originalHeight)
  - `sampleCount`: Number of data points in cluster
- `heightData`: 2D array of terrain heights (gridSize × gridSize)
- `metrics.giniCoefficient`: 0 = equal, 1 = unequal distribution
- `metrics.flatnessScore`: 1 - giniCoefficient (higher = more balanced)

**Errors**:
- `400 Bad Request`: Dataset not ready (still processing)
- `404 Not Found`: Dataset ID doesn't exist

---

### POST `/api/adjust/{dataset_id}`

Adjust cluster weights.

**Request**:
```http
POST /api/adjust/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Content-Type: application/json

{
  "adjustments": {
    "0": 0.5,
    "1": 1.5,
    "3": 0.0,
    "7": 2.0
  }
}
```

**Body**:
- `adjustments`: Object mapping cluster ID (int) to new weight (float)
  - `0.0`: Exclude cluster completely
  - `< 1.0`: Undersample cluster
  - `1.0`: Keep original distribution
  - `> 1.0`: Oversample cluster
  - `2.0`: Maximum recommended weight

**Response** (200 OK):
```json
{
  "success": true,
  "updated_metrics": {
    "giniCoefficient": 0.28,
    "flatnessScore": 0.72
  },
  "message": "Weights updated successfully"
}
```

**Errors**:
- `400 Bad Request`: Invalid weight values
- `404 Not Found`: Dataset ID doesn't exist

---

### GET `/api/export/{dataset_id}`

Export balanced dataset.

**Request**:
```http
GET /api/export/550e8400-e29b-41d4-a716-446655440000?format=weighted HTTP/1.1
```

**Query Parameters**:
- `format` (optional): `weighted` (default) or `resampled`

**Format Types**:
- **weighted**: Original CSV + `cluster_id` and `weight` columns
- **resampled**: New CSV with weighted sampling applied

**Response** (200 OK):
```http
Content-Type: text/csv
Content-Disposition: attachment; filename="balanced_dataset.csv"

id,name,description,cluster_id,weight
1,John Doe,Senior Software Engineer...,0,0.5
2,Jane Smith,Junior Developer...,1,1.5
3,Bob Johnson,Data Scientist...,0,0.5
...
```

**Weighted Format**:
- Preserves all original rows
- Adds `cluster_id` column (integer)
- Adds `weight` column (float)
- Use weights for sampling in ML training

**Resampled Format**:
- Generates new balanced dataset
- Undersamples overrepresented clusters
- Oversamples underrepresented clusters (with replacement)
- Final size varies based on weights

**Errors**:
- `404 Not Found`: Dataset ID doesn't exist

---

### GET `/health`

Health check endpoint.

**Request**:
```http
GET /health HTTP/1.1
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "datasets_in_memory": 3,
  "model_loaded": true,
  "timestamp": "2025-10-04T12:34:56Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error category",
  "detail": "Detailed error message",
  "path": "/api/upload"
}
```

### Common HTTP Status Codes

- `200 OK`: Success
- `400 Bad Request`: Invalid input (file format, missing fields, etc.)
- `404 Not Found`: Resource doesn't exist
- `413 Payload Too Large`: File exceeds size limit
- `415 Unsupported Media Type`: Wrong file type
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side failure

### Example Error Responses

**Invalid File Type**:
```json
{
  "error": "Invalid file type",
  "detail": "Only CSV files supported",
  "path": "/api/upload"
}
```

**Dataset Too Small**:
```json
{
  "error": "Invalid dataset",
  "detail": "Dataset too small (min 50 rows)",
  "path": "/api/upload"
}
```

**Processing Failed**:
```json
{
  "error": "Processing error",
  "detail": "Embedding generation failed: Out of memory",
  "path": "/api/status/550e8400..."
}
```

---

## Data Models

### Hill Object

```typescript
interface Hill {
  id: number;                    // Cluster ID (0-indexed)
  center: [number, number];      // [X, Z] position on terrain
  height: number;                // Current height (0-20)
  originalHeight: number;        // Initial height (cluster size)
  radius: number;                // Hill base radius (5-15 typical)
  label: string;                 // Short description (2-4 words)
  description?: string;          // Extended description (optional)
  weight: number;                // Sampling weight (0-2.0)
  color: string;                 // Hex color (#RRGGBB)
  sampleCount: number;           // Number of data points
  samples?: string[];            // Representative samples (optional)
}
```

### TerrainData Object

```typescript
interface TerrainData {
  hills: Hill[];                 // Array of cluster hills
  gridSize: number;              // Grid resolution (typically 100)
  heightData: number[][];        // 2D height array [gridSize][gridSize]
  metrics: BiasMetrics;          // Dataset statistics
}
```

### BiasMetrics Object

```typescript
interface BiasMetrics {
  totalPoints: number;           // Total data points
  clusterCount: number;          // Number of clusters found
  giniCoefficient: number;       // Inequality measure (0-1)
  flatnessScore: number;         // Balance score (0-1, higher is better)
}
```

---

## WebSocket API (Future)

For real-time updates during processing:

```
ws://localhost:8000/ws/{dataset_id}
```

**Messages**:
```json
{
  "type": "progress",
  "progress": 45,
  "stage": "clustering"
}
```

```json
{
  "type": "completed",
  "terrain_data": {...}
}
```

**Not implemented in MVP** - use polling instead

---

## Rate Limits

### Current Limits (Development)
- Upload: 5 requests/minute per IP
- Other endpoints: No limit

### Future Limits (Production)
- Upload: 10 requests/hour per API key
- Status/Terrain: 100 requests/minute per API key
- Adjust: 30 requests/minute per API key

---

## CORS Configuration

### Allowed Origins
- Development: `http://localhost:3000`
- Production: `https://level.app` (TBD)

### Allowed Methods
- `GET`, `POST`, `OPTIONS`

### Allowed Headers
- `Content-Type`, `Authorization`

---

## Authentication (Future)

### API Key (Planned)

**Request Header**:
```http
Authorization: Bearer YOUR_API_KEY_HERE
```

**Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized",
  "detail": "Invalid or missing API key"
}
```

---

## Versioning

### Current Version
- API Version: `v1` (implicit, no version in URL)
- Breaking changes will introduce `/v2/` prefix

### Future Versioning
```
POST /v2/api/upload
GET /v2/api/terrain/{dataset_id}
```

---

## Examples

### Complete Flow Example

#### 1. Upload CSV

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@dataset.csv" \
  -F "text_column=description"
```

Response:
```json
{
  "dataset_id": "abc-123",
  "status": "processing",
  "row_count": 500
}
```

#### 2. Poll Status

```bash
curl http://localhost:8000/api/status/abc-123
```

Response (processing):
```json
{
  "status": "processing",
  "progress": 75,
  "stage": "analyzing"
}
```

Response (completed):
```json
{
  "status": "completed",
  "progress": 100,
  "stage": "completed"
}
```

#### 3. Get Terrain

```bash
curl http://localhost:8000/api/terrain/abc-123
```

Response: Full terrain data (see above)

#### 4. Adjust Weights

```bash
curl -X POST http://localhost:8000/api/adjust/abc-123 \
  -H "Content-Type: application/json" \
  -d '{"adjustments": {"0": 0.5, "2": 1.5}}'
```

Response:
```json
{
  "success": true,
  "updated_metrics": {
    "giniCoefficient": 0.32,
    "flatnessScore": 0.68
  }
}
```

#### 5. Export Dataset

```bash
curl http://localhost:8000/api/export/abc-123?format=weighted \
  -o balanced_dataset.csv
```

Downloads CSV file.

---

## Client Implementation Example

### JavaScript/TypeScript

```typescript
class LevelAPI {
  private baseURL = 'http://localhost:8000';
  
  async upload(file: File, textColumn?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (textColumn) formData.append('text_column', textColumn);
    
    const response = await fetch(`${this.baseURL}/api/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }
  
  async pollUntilComplete(datasetId: string) {
    while (true) {
      const status = await this.getStatus(datasetId);
      
      if (status.status === 'completed') {
        return await this.getTerrain(datasetId);
      } else if (status.status === 'failed') {
        throw new Error('Processing failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  async getStatus(datasetId: string) {
    const response = await fetch(`${this.baseURL}/api/status/${datasetId}`);
    return response.json();
  }
  
  async getTerrain(datasetId: string) {
    const response = await fetch(`${this.baseURL}/api/terrain/${datasetId}`);
    return response.json();
  }
  
  async adjustWeights(datasetId: string, adjustments: Record<number, number>) {
    const response = await fetch(`${this.baseURL}/api/adjust/${datasetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustments })
    });
    return response.json();
  }
  
  getExportURL(datasetId: string, format: 'weighted' | 'resampled' = 'weighted') {
    return `${this.baseURL}/api/export/${datasetId}?format=${format}`;
  }
}

// Usage
const api = new LevelAPI();

// Upload and wait for completion
const { dataset_id } = await api.upload(file, 'description');
const terrainData = await api.pollUntilComplete(dataset_id);

// Adjust weights
await api.adjustWeights(dataset_id, { 0: 0.5, 1: 1.5 });

// Export
window.location.href = api.getExportURL(dataset_id, 'weighted');
```

---

## Performance Considerations

### Response Times (Typical)

- `/upload`: < 1 second (returns immediately)
- `/status`: < 100ms
- `/terrain`: < 500ms (cached after first request)
- `/adjust`: < 200ms
- `/export`: 1-3 seconds (generates CSV)

### Processing Times (Depends on Dataset Size)

| Dataset Size | CPU Time | GPU Time |
|-------------|----------|----------|
| 100 rows | 10 sec | 5 sec |
| 500 rows | 45 sec | 15 sec |
| 1000 rows | 2 min | 30 sec |
| 5000 rows | 10 min | 3 min |

### Optimization Tips

1. **Polling Frequency**: Poll every 2 seconds (don't overload server)
2. **Caching**: Terrain data is cached, safe to refetch
3. **Batch Adjustments**: Send multiple weight changes in one request
4. **Export Format**: `weighted` is faster than `resampled`

---

## API Changes and Migration

### Breaking Changes Policy

- Major version bump for breaking changes (v1 → v2)
- Old versions supported for 6 months
- Deprecation warnings in response headers

### Changelog

**v1.0.0** (Current)
- Initial release
- CSV-only support
- Basic terrain visualization

**Future (v1.1.0)**
- Add multimodal support (images, audio, video)
- WebSocket for real-time updates
- Batch upload endpoint

---

## Testing the API

### Manual Testing (curl)

See examples above.

### Automated Testing (Postman/Insomnia)

Import collection (TBD - create JSON export)

### Integration Tests

```python
import requests

# Upload test
files = {'file': open('test.csv', 'rb')}
response = requests.post('http://localhost:8000/api/upload', files=files)
assert response.status_code == 200

dataset_id = response.json()['dataset_id']

# Poll until complete
while True:
    status = requests.get(f'http://localhost:8000/api/status/{dataset_id}').json()
    if status['status'] == 'completed':
        break
    time.sleep(2)

# Get terrain
terrain = requests.get(f'http://localhost:8000/api/terrain/{dataset_id}').json()
assert 'hills' in terrain
assert len(terrain['hills']) > 0
```

---

**For implementation details:**
- Backend: See BACKEND.md
- Frontend: See FRONTEND.md
- High-level architecture: See PLAN.md