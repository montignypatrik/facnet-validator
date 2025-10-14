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
  const hasInitializedRef = useRef(false);

  // Initialize timer on first mount regardless of status
  useEffect(() => {
    if (!hasInitializedRef.current) {
      startTimeRef.current = Date.now();
      hasInitializedRef.current = true;
    }
  }, []);

  // Reset start time only when job first starts (queued status after initialization)
  useEffect(() => {
    if (status === 'queued' && hasInitializedRef.current) {
      startTimeRef.current = Date.now();
      setIsMinimumTimeMet(false);
      setDisplayProgress(0);
    }
  }, [status]); // Only reset when status changes AND status is 'queued'

  useEffect(() => {
    // Animate progress smoothly using requestAnimationFrame
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const elapsedSeconds = elapsed / 1000;

      // Minimum 5-second display time
      const minimumTime = 5;

      // Enforce 5-second minimum even if completed/failed
      if (elapsedSeconds >= minimumTime) {
        setIsMinimumTimeMet(true);
        // After 5 seconds, show real progress (or 100% if completed)
        const finalProgress = (status === 'completed' || status === 'failed') ? 100 : realProgress;
        setDisplayProgress(finalProgress);

        // Stop animating once minimum time is met and job is done
        if (status === 'completed' || status === 'failed') {
          return;
        }
      } else {
        // Generate artificial smooth progress over 5 seconds
        // Using easeOutQuad for smooth deceleration
        const normalizedTime = elapsedSeconds / minimumTime;
        const easedProgress = 1 - Math.pow(1 - normalizedTime, 2);

        // If job completed early, animate smoothly to 95% over remaining time
        const targetProgress = (status === 'completed' || status === 'failed') ? 95 : realProgress;

        // Cap artificial progress at 95% to leave room for real completion
        const artificialProgress = Math.min(easedProgress * 95, 95);

        // Blend artificial and real/target progress
        const blendFactor = normalizedTime; // 0 to 1 over 5 seconds
        const blended = artificialProgress * (1 - blendFactor) + targetProgress * blendFactor;

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
