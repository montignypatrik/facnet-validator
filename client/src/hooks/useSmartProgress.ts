import { useState, useEffect, useRef } from "react";

export type ProgressPhase = 'initializing' | 'processing' | 'finalizing' | 'complete';

interface UseSmartProgressOptions {
  realProgress?: number;
  status: string;
}

interface UseSmartProgressReturn {
  displayProgress: number;
  isMinimumTimeMet: boolean;
  phase: ProgressPhase;
}

/**
 * Smart progress hook that provides smooth, animated progress with minimum display time.
 *
 * This hook generates artificial progress over 5 seconds to provide a polished user experience,
 * then blends with real backend progress. It ensures users see a smooth progression even if
 * the backend processes very quickly.
 *
 * Progress phases:
 * - 0-2s: 'initializing' (0-40%)
 * - 2-4s: 'processing' (40-80%)
 * - 4-5s: 'finalizing' (80-95%)
 * - 5s+: Use real progress from backend
 */
export function useSmartProgress({ realProgress = 0, status }: UseSmartProgressOptions): UseSmartProgressReturn {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isMinimumTimeMet, setIsMinimumTimeMet] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();

  // Reset start time when status changes to running/queued
  useEffect(() => {
    if (status === 'queued' || status === 'processing') {
      startTimeRef.current = Date.now();
      setIsMinimumTimeMet(false);
      setDisplayProgress(0);
    }
  }, [status]);

  useEffect(() => {
    // Don't animate if completed or failed
    if (status === 'completed' || status === 'failed') {
      setDisplayProgress(realProgress);
      setIsMinimumTimeMet(true);
      return;
    }

    // Animate progress smoothly using requestAnimationFrame
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const elapsedSeconds = elapsed / 1000;

      // Minimum 5-second display time
      const minimumTime = 5;

      if (elapsedSeconds >= minimumTime) {
        setIsMinimumTimeMet(true);
        // After 5 seconds, use real progress from backend
        setDisplayProgress(realProgress);
      } else {
        // Generate artificial smooth progress over 5 seconds
        // Using easeOutQuad for smooth deceleration
        const normalizedTime = elapsedSeconds / minimumTime;
        const easedProgress = 1 - Math.pow(1 - normalizedTime, 2);

        // Cap artificial progress at 95% to leave room for real completion
        const artificialProgress = Math.min(easedProgress * 95, 95);

        // Blend artificial and real progress, favoring artificial early on
        const blendFactor = normalizedTime; // 0 to 1 over 5 seconds
        const blended = artificialProgress * (1 - blendFactor) + realProgress * blendFactor;

        setDisplayProgress(Math.min(blended, 95));
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [realProgress, status]);

  // Determine current phase based on display progress
  const phase: ProgressPhase = (() => {
    if (status === 'completed') return 'complete';
    if (displayProgress < 40) return 'initializing';
    if (displayProgress < 80) return 'processing';
    return 'finalizing';
  })();

  return {
    displayProgress,
    isMinimumTimeMet,
    phase,
  };
}
