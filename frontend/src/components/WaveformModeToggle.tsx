'use client';

import { WaveformMode } from '@/types';

interface WaveformModeToggleProps {
  mode: WaveformMode;
  onModeChange: (mode: WaveformMode) => void;
}

export default function WaveformModeToggle({ mode, onModeChange }: WaveformModeToggleProps) {
  return (
    <div className="flex border border-[#333] rounded-lg overflow-hidden w-fit">
      <button
        onClick={() => onModeChange('count')}
        className={`px-6 py-3 font-semibold transition-colors text-sm ${
          mode === 'count'
            ? 'bg-white text-black'
            : 'bg-black text-white/60 hover:text-white hover:bg-white/5'
        }`}
      >
        Data Points
      </button>
      <button
        onClick={() => onModeChange('weight')}
        className={`px-6 py-3 font-semibold transition-colors text-sm ${
          mode === 'weight'
            ? 'bg-white text-black'
            : 'bg-black text-white/60 hover:text-white hover:bg-white/5'
        }`}
      >
        Weights
      </button>
    </div>
  );
}
