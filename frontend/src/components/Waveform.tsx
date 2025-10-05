"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { WaveformData, WaveformMode } from '@/types';
import { apiClient } from '@/lib/api-client';

interface WaveformProps {
  datasetId: string;
  initialData: WaveformData;
  onDataUpdate: (data: WaveformData) => void;
  onClusterClick?: (peakId: number) => void;
  mode: WaveformMode;
}

export default function Waveform({ datasetId, initialData, onDataUpdate, onClusterClick, mode }: WaveformProps) {
  const [data, setData] = useState<WaveformData>(initialData);
  const [draggingPeak, setDraggingPeak] = useState<number | null>(null);
  const [hoveredPeak, setHoveredPeak] = useState<number | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 1100;
  const height = 700;
  const padding = 100;

  const generateSmoothPath = () => {
    if (data.peaks.length === 0) return "";

    if (mode === 'count') {
      // Find the maximum cluster size to normalize heights
      const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount));

      const points = data.peaks.map((p) => {
        // Calculate ratio based on absolute count vs max count
        const selectedCount = p.selectedCount ?? p.sampleCount;
        const ratio = maxSampleCount > 0 ? selectedCount / maxSampleCount : 1;
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    } else {
      // Weight mode - fixed scale 0.01 to 2, with 1.0 near middle
      const minWeight = 0.01;
      const maxWeight = 2;

      const points = data.peaks.map((p) => {
        const weight = p.weight ?? 1.0;
        // Normalize to 0-1 range where 0.01 = bottom, 1.0 ≈ middle, 2.0 = top
        const ratio = (weight - minWeight) / (maxWeight - minWeight);
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    }
  };

  const generateGhostPath = () => {
    if (data.peaks.length === 0) return "";

    if (mode === 'count') {
      // Find the maximum cluster size to normalize heights
      const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount));

      const points = data.peaks.map((p) => {
        // Always use original sampleCount for ghost path
        const ratio = maxSampleCount > 0 ? p.sampleCount / maxSampleCount : 1;
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    } else {
      // Weight mode: Show baseline (weight = 1.0) near middle
      const baselineWeight = 1.0;
      const minWeight = 0.01;
      const maxWeight = 2;

      const points = data.peaks.map((p) => {
        // Baseline 1.0 maps to near middle
        const ratio = (baselineWeight - minWeight) / (maxWeight - minWeight);
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    }
  };

  const generateSuggestedPath = () => {
    if (data.peaks.length === 0) return "";

    // Check if any peak has suggested counts or weights
    const hasSuggestions = mode === 'count'
      ? data.peaks.some(p => p.suggestedCount !== undefined)
      : data.peaks.some(p => p.suggestedWeight !== undefined);

    if (!hasSuggestions) return '';

    if (mode === 'count') {
      // Find the maximum cluster size to normalize heights
      const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount));

      const points = data.peaks.map((p) => {
        // Use suggestedCount if available, fallback to selectedCount
        const suggestedCount = p.suggestedCount ?? p.selectedCount;
        const ratio = maxSampleCount > 0 ? suggestedCount / maxSampleCount : 1;
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    } else {
      // Weight mode - fixed scale 0.01 to 2
      const minWeight = 0.01;
      const maxWeight = 2;

      const points = data.peaks.map((p) => {
        const suggestedWeight = p.suggestedWeight ?? (p.weight ?? 1.0);
        const ratio = (suggestedWeight - minWeight) / (maxWeight - minWeight);
        return {
          x: p.x * (width - 2 * padding) + padding,
          y: (1 - ratio) * (height - 2 * padding) + padding,
        };
      });

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const dx = (curr.x - prev.x) / 3;

        path += ` C ${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
      }

      return path;
    }
  };

  const handleMouseDown = (peakId: number) => {
    setDraggingPeak(peakId);
    setHasDragged(false);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingPeak === null || !svgRef.current) return;

    setHasDragged(true);
    const rect = svgRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const normalizedY = (y - padding) / (height - 2 * padding);
    const ratio = Math.max(0, Math.min(1, 1 - normalizedY));

    setData((prevData) => {
      if (mode === 'count') {
        const maxSampleCount = Math.max(...prevData.peaks.map((p) => p.sampleCount));

        return {
          ...prevData,
          peaks: prevData.peaks.map((peak) => {
            if (peak.id === draggingPeak) {
              // Calculate count based on ratio relative to max, but clamp to peak's sampleCount
              const absoluteCount = Math.round(ratio * maxSampleCount);
              const newSelectedCount = Math.min(absoluteCount, peak.sampleCount);
              return { ...peak, selectedCount: newSelectedCount };
            }
            return peak;
          }),
        };
      } else {
        // Weight mode - fixed scale 0.01 to 2 (avoid exactly 0)
        const minWeight = 0.01;
        const maxWeight = 2;

        return {
          ...prevData,
          peaks: prevData.peaks.map((peak) => {
            if (peak.id === draggingPeak) {
              // Calculate weight based on ratio (0.01 to 2 range)
              const newWeight = minWeight + ratio * (maxWeight - minWeight);
              const clampedWeight = Math.max(minWeight, Math.min(maxWeight, newWeight));
              return { ...peak, weight: Number(clampedWeight.toFixed(2)) };
            }
            return peak;
          }),
        };
      }
    });
  };

  const finishDrag = useCallback(async () => {
    if (draggingPeak === null) return;

    const peakId = draggingPeak;
    const wasDragged = hasDragged;
    const adjustedPeak = data.peaks.find((p) => p.id === draggingPeak);

    if (!adjustedPeak) return;

    // If it was a click (no drag), trigger the click handler
    if (!wasDragged && onClusterClick) {
      onClusterClick(peakId);
      setDraggingPeak(null);
      return;
    }

    // Otherwise, update the selectedCount or weight
    try {
      if (mode === 'count') {
        const selectedCount = adjustedPeak.selectedCount ?? adjustedPeak.sampleCount;
        const updatedData = await apiClient.adjustAmplitudes(datasetId, {
          adjustments: [{ id: adjustedPeak.id, selectedCount }],
        });

        setData(updatedData);
        onDataUpdate(updatedData);
      } else {
        const weight = adjustedPeak.weight ?? 1.0;
        const updatedData = await apiClient.adjustAmplitudes(datasetId, {
          adjustments: [{ id: adjustedPeak.id, weight }],
        });

        setData(updatedData);
        onDataUpdate(updatedData);
      }
    } catch (err) {
      console.error("Failed to update peak:", err);
    }

    setDraggingPeak(null);
  }, [draggingPeak, hasDragged, data.peaks, mode, onClusterClick, datasetId, onDataUpdate]);

  const handleMouseUp = async () => {
    await finishDrag();
  };

  useEffect(() => {
    window.addEventListener('mouseup', finishDrag);
    return () => window.removeEventListener('mouseup', finishDrag);
  }, [finishDrag]);

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-[#333] rounded-lg bg-black cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Ghost waveform path (original cluster sizes) */}
        <path
          d={generateGhostPath()}
          stroke="#ffffff"
          strokeWidth={2}
          fill="none"
          opacity={0.3}
        />

        {/* AI Suggested waveform path */}
        {generateSuggestedPath() && (
          <path
            d={generateSuggestedPath()}
            stroke="#ffffff"
            strokeWidth={2}
            fill="none"
            opacity={0.5}
            strokeDasharray="5,5"
          />
        )}

        {/* Smooth waveform path (current selected counts) */}
        <path
          d={generateSmoothPath()}
          stroke="#ffffff"
          strokeWidth={2}
          fill="none"
        />

        {/* Ghost peak markers (original cluster sizes or baseline weight) */}
        {(() => {
          if (mode === 'count') {
            const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount));
            return data.peaks.map((peak) => {
              const ratio = maxSampleCount > 0 ? peak.sampleCount / maxSampleCount : 1;
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`ghost-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={peak.color}
                  stroke="#ffffff"
                  strokeWidth={1}
                  opacity={0.3}
                  className="pointer-events-none"
                />
              );
            });
          } else {
            // Weight mode: Show baseline weight = 1.0 near middle
            const baselineWeight = 1.0;
            const minWeight = 0.01;
            const maxWeight = 2;
            return data.peaks.map((peak) => {
              const ratio = (baselineWeight - minWeight) / (maxWeight - minWeight);
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`ghost-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={peak.color}
                  stroke="#ffffff"
                  strokeWidth={1}
                  opacity={0.3}
                  className="pointer-events-none"
                />
              );
            });
          }
        })()}

        {/* AI Suggested peak markers */}
        {(() => {
          const hasSuggestions = mode === 'count'
            ? data.peaks.some(p => p.suggestedCount !== undefined)
            : data.peaks.some(p => p.suggestedWeight !== undefined);

          if (!hasSuggestions) return null;

          if (mode === 'count') {
            const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount));
            return data.peaks.map((peak) => {
              if (peak.suggestedCount === undefined) return null;

              const ratio = maxSampleCount > 0 ? peak.suggestedCount / maxSampleCount : 1;
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`suggested-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={5}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={1}
                  opacity={0.6}
                  className="pointer-events-none"
                />
              );
            });
          } else {
            // Weight mode - fixed scale 0.01 to 2
            const minWeight = 0.01;
            const maxWeight = 2;
            return data.peaks.map((peak) => {
              if (peak.suggestedWeight === undefined) return null;

              const ratio = (peak.suggestedWeight - minWeight) / (maxWeight - minWeight);
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;

              return (
                <circle
                  key={`suggested-${peak.id}`}
                  cx={x}
                  cy={y}
                  r={5}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={1}
                  opacity={0.6}
                  className="pointer-events-none"
                />
              );
            });
          }
        })()}

        {/* Peak markers (interactive) */}
        {(() => {
          if (mode === 'count') {
            const maxSampleCount = Math.max(...data.peaks.map((p) => p.sampleCount));
            return data.peaks.map((peak) => {
              const selectedCount = peak.selectedCount ?? peak.sampleCount;
              const ratio = maxSampleCount > 0 ? selectedCount / maxSampleCount : 1;
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;
              const isDragging = draggingPeak === peak.id;
              const isHovered = hoveredPeak === peak.id;

              return (
                <g key={peak.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isDragging ? 10 : isHovered ? 8 : 6}
                    fill={peak.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={() => handleMouseDown(peak.id)}
                    onMouseEnter={() => setHoveredPeak(peak.id)}
                    onMouseLeave={() => setHoveredPeak(null)}
                  />

                  {/* Label */}
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    className="pointer-events-none select-none"
                  >
                    {peak.label}
                  </text>

                  {/* Count indicator on hover or drag */}
                  {(isHovered || isDragging) && (
                    <text
                      x={x}
                      y={y + 25}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={10}
                      className="pointer-events-none select-none"
                    >
                      {selectedCount.toLocaleString()} / {peak.sampleCount.toLocaleString()}
                    </text>
                  )}
                </g>
              );
            });
          } else {
            // Weight mode - fixed scale 0.01 to 2
            const minWeight = 0.01;
            const maxWeight = 2;
            return data.peaks.map((peak) => {
              const weight = peak.weight ?? 1.0;
              const ratio = (weight - minWeight) / (maxWeight - minWeight);
              const x = peak.x * (width - 2 * padding) + padding;
              const y = (1 - ratio) * (height - 2 * padding) + padding;
              const isDragging = draggingPeak === peak.id;
              const isHovered = hoveredPeak === peak.id;

              return (
                <g key={peak.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isDragging ? 10 : isHovered ? 8 : 6}
                    fill={peak.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={() => handleMouseDown(peak.id)}
                    onMouseEnter={() => setHoveredPeak(peak.id)}
                    onMouseLeave={() => setHoveredPeak(null)}
                  />

                  {/* Label */}
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={12}
                    className="pointer-events-none select-none"
                  >
                    {peak.label}
                  </text>

                  {/* Weight indicator on hover or drag */}
                  {(isHovered || isDragging) && (
                    <text
                      x={x}
                      y={y + 25}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={10}
                      className="pointer-events-none select-none"
                    >
                      Weight: {weight.toFixed(2)}x
                    </text>
                  )}
                </g>
              );
            });
          }
        })()}
      </svg>
    </div>
  );
}
