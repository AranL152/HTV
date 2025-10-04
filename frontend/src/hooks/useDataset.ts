import { useState, useEffect } from 'react';
import { getStatus, getTerrain } from '@/services/api';
import type { StatusResponse, TerrainData } from '@/types/terrain';

interface UseDatasetResult {
  terrain: TerrainData | null;
  status: StatusResponse | null;
  loading: boolean;
  error: string | null;
}

export function useDataset(datasetId: string | null): UseDatasetResult {
  const [terrain, setTerrain] = useState<TerrainData | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const pollStatus = async () => {
      try {
        const statusData = await getStatus(datasetId);

        if (!isMounted) return;

        setStatus(statusData);

        if (statusData.status === 'completed') {
          const terrainData = await getTerrain(datasetId);
          if (isMounted) {
            setTerrain(terrainData);
            setLoading(false);
          }
        } else if (statusData.status === 'failed') {
          setError(statusData.message || 'Processing failed');
          setLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        setLoading(false);
      }
    };

    pollStatus();
    const pollInterval = setInterval(pollStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [datasetId]);

  return { terrain, status, loading, error };
}
