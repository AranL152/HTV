import { useState, useCallback, useRef } from 'react';

interface UseDragResult {
  draggingHillId: number | null;
  startDrag: (hillId: number, clientY: number, currentHeight: number) => void;
  onDragMove: (clientY: number) => number | null;
  endDrag: () => void;
}

export function useDrag(onHeightChange: (hillId: number, newHeight: number) => void): UseDragResult {
  const [draggingHillId, setDraggingHillId] = useState<number | null>(null);
  const dragStateRef = useRef<{
    hillId: number;
    startY: number;
    originalHeight: number;
  } | null>(null);

  const startDrag = useCallback((hillId: number, clientY: number, currentHeight: number) => {
    setDraggingHillId(hillId);
    dragStateRef.current = {
      hillId,
      startY: clientY,
      originalHeight: currentHeight,
    };
  }, []);

  const onDragMove = useCallback(
    (clientY: number): number | null => {
      if (!dragStateRef.current) return null;

      const { hillId, startY, originalHeight } = dragStateRef.current;
      const deltaY = startY - clientY;
      const heightChange = deltaY * 0.05;
      const newHeight = originalHeight + heightChange;

      onHeightChange(hillId, newHeight);
      return newHeight;
    },
    [onHeightChange]
  );

  const endDrag = useCallback(() => {
    setDraggingHillId(null);
    dragStateRef.current = null;
  }, []);

  return {
    draggingHillId,
    startDrag,
    onDragMove,
    endDrag,
  };
}
