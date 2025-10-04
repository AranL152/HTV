'use client';

import { useState, useRef, useEffect } from 'react';
import { ClusterPeak, WaveformData } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface WaveformProps {
  datasetId: string;
  initialData: WaveformData;
  onDataUpdate: (data: WaveformData) => void;
}

export default function Waveform({ datasetId, initialData, onDataUpdate }: WaveformProps) {
  const [data, setData] = useState<WaveformData>(initialData);
  const [draggingPeak, setDraggingPeak] = useState<number | null>(null);
  const [hoveredPeak, setHoveredPeak] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 1000;
  const height = 400;
  const padding = 40;

  const generateSmoothPath = (peaks: ClusterPeak[]): string => {
    if (peaks.length === 0) return '';

    const points = peaks.map((p) => ({
      x: p.x * (width - 2 * padding) + padding,
      y: (1 - p.amplitude) * (height - 2 * padding) + padding,
    }));

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
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingPeak === null || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const normalizedY = (y - padding) / (height - 2 * padding);
    const newAmplitude = Math.max(0, Math.min(2, 1 - normalizedY));

    setData((prevData) => ({
      ...prevData,
      peaks: prevData.peaks.map((peak) =>
        peak.id === draggingPeak
          ? { ...peak, amplitude: newAmplitude, weight: newAmplitude / peak.originalAmplitude }
          : peak
      ),
    }));
  };

  const handleMouseUp = async () => {
    if (draggingPeak === null) return;

    const adjustedPeak = data.peaks.find((p) => p.id === draggingPeak);
    if (!adjustedPeak) return;

    try {
      const response = await fetch(`${API_URL}/api/adjust/${datasetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustments: [{ id: adjustedPeak.id, amplitude: adjustedPeak.amplitude }],
        }),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setData(updatedData);
        onDataUpdate(updatedData);
      }
    } catch (err) {
      console.error('Failed to update peak:', err);
    }

    setDraggingPeak(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingPeak !== null) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [draggingPeak]);

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
        {/* Smooth waveform path */}
        <path
          d={generateSmoothPath(data.peaks)}
          stroke="#ffffff"
          strokeWidth={2}
          fill="none"
        />

        {/* Peak markers */}
        {data.peaks.map((peak) => {
          const x = peak.x * (width - 2 * padding) + padding;
          const y = (1 - peak.amplitude) * (height - 2 * padding) + padding;
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
                  {(peak.weight * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
