/**
 * Centralized, type-safe API client with error handling
 */

import { config } from './config';
import type {
  UploadResponse,
  WaveformData,
  AdjustmentRequest,
  ApiError,
  ChatRequest,
  ChatResponse,
} from '@/types';

const API_URL = config.apiUrl;

/**
 * Base fetch wrapper with error handling and timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // If JSON parsing fails, use the default error message
    }

    const error = new Error(errorMessage) as ApiError;
    error.status = response.status;
    error.details = errorMessage;
    throw error;
  }

  return response.json();
}

/**
 * API Client
 */
export const apiClient = {
  /**
   * Upload a CSV file for processing
   */
  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithTimeout(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    }, 180000);

    return handleResponse<UploadResponse>(response);
  },

  /**
   * Get waveform data for a dataset
   */
  async getWaveform(datasetId: string): Promise<WaveformData> {
    const response = await fetchWithTimeout(
      `${API_URL}/api/waveform/${datasetId}`
    );

    return handleResponse<WaveformData>(response);
  },

  /**
   * Adjust peak selected counts
   */
  async adjustAmplitudes(
    datasetId: string,
    adjustments: AdjustmentRequest
  ): Promise<WaveformData> {
    const response = await fetchWithTimeout(
      `${API_URL}/api/adjust/${datasetId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustments),
      }
    );

    return handleResponse<WaveformData>(response);
  },

  /**
   * Export balanced dataset as CSV
   */
  async exportDataset(datasetId: string): Promise<Blob> {
    const response = await fetchWithTimeout(
      `${API_URL}/api/export/${datasetId}`
    );

    if (!response.ok) {
      const errorMessage = `Export failed: ${response.statusText}`;
      const error = new Error(errorMessage) as ApiError;
      error.status = response.status;
      throw error;
    }

    return response.blob();
  },

  /**
   * Send chat message about dataset
   */
  async chat(datasetId: string, message: string): Promise<ChatResponse> {
    const response = await fetchWithTimeout(
      `${API_URL}/api/chat/${datasetId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message } as ChatRequest),
      },
      60000 // 60s timeout for AI response
    );

    return handleResponse<ChatResponse>(response);
  },
};
