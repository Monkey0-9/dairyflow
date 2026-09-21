// Pure JavaScript Browser Haptics Feedback (Navigator Vibration API)

export function vibrateLight(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch (err) {
      console.debug('[Haptics] Vibrate light failed:', err);
    }
  }
}

export function vibrateMedium(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(25);
    } catch (err) {
      console.debug('[Haptics] Vibrate medium failed:', err);
    }
  }
}

export function vibrateSuccess(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 30, 20]);
    } catch (err) {
      console.warn('[Haptics] Vibrate failed:', err);
    }
  }
}

export function vibrateError(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([40, 40, 40]);
    } catch (err) {
      console.warn('[Haptics] Vibrate failed:', err);
    }
  }
}
