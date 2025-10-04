import type { UploadResponse, StatusResponse, TerrainData, AdjustResponse } from '@/types/terrain';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(response.status, error.detail || error.error || 'Request failed');
  }
  return response.json();
}

export async function uploadFile(file: File, textColumn?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (textColumn) {
    formData.append('text_column', textColumn);
  }

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function getStatus(datasetId: string): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/status/${datasetId}`);
  return handleResponse<StatusResponse>(response);
}

export async function getTerrain(datasetId: string): Promise<TerrainData> {
  const response = await fetch(`${API_BASE_URL}/api/terrain/${datasetId}`);
  return handleResponse<TerrainData>(response);
}

export async function adjustWeights(
  datasetId: string,
  adjustments: Record<number, number>
): Promise<AdjustResponse> {
  const response = await fetch(`${API_BASE_URL}/api/adjust/${datasetId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ adjustments }),
  });

  return handleResponse<AdjustResponse>(response);
}

export function getExportUrl(datasetId: string, format: 'weighted' | 'resampled' = 'weighted'): string {
  return `${API_BASE_URL}/api/export/${datasetId}?format=${format}`;
}
