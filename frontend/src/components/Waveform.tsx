'use client';

import { useState, useRef, useEffect } from 'react';
import { WaveformData } from '@/types';
import { apiClient } from '@/lib/api-client';

interface WaveformProps {
  datasetId: string;
  initialData: WaveformData;
  onDataUpdate: (data: WaveformData) => void;
  onClusterClick?: (peakId: number) => void;
}

export default function Waveform({ datasetId, initialData, onDataUpdate, onClusterClick }: WaveformProps) {
  const [data, setData] = useState<WaveformData>(initialData);
  const [draggingPeak, setDraggingPeak] = useState<number | null>(null);
  const [hoveredPeak, setHoveredPeak] = useState<number | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 1000;
  const height = 400;
  const padding = 40;

  const generateSmoothPath = () => {
    if (data.peaks.length === 0) return '';

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
  };

  const generateGhostPath = () => {
    if (data.peaks.length === 0) return '';

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
    });
  };

  const finishDrag = async () => {
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

    // Otherwise, update the selectedCount
    try {
      const selectedCount = adjustedPeak.selectedCount ?? adjustedPeak.sampleCount;
      const updatedData = await apiClient.adjustAmplitudes(datasetId, {
        adjustments: [{ id: adjustedPeak.id, selectedCount }],
      });

      setData(updatedData);
      onDataUpdate(updatedData);
    } catch (err) {
      console.error('Failed to update peak:', err);
    }

    setDraggingPeak(null);
  };

  const handleMouseUp = async () => {
    await finishDrag();
  };

  useEffect(() => {
    window.addEventListener('mouseup', finishDrag);
    return () => window.removeEventListener('mouseup', finishDrag);
  }, [draggingPeak, hasDragged, data.peaks, datasetId, onDataUpdate, onClusterClick]);

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

        {/* Smooth waveform path (current selected counts) */}
        <path
          d={generateSmoothPath()}
          stroke="#ffffff"
          strokeWidth={2}
          fill="none"
        />

        {/* Ghost peak markers (original cluster sizes) */}
        {(() => {
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
        })()}

        {/* Peak markers (interactive) */}
        {(() => {
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
        })()}
      </svg>
    </div>
  );
}
