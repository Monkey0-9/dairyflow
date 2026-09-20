// Pure JavaScript Browser Haptics Feedback (Navigator Vibration API)

export function vibrateLight(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      // Ignored if user has not interacted or device unsupported
    }
  }
}

export function vibrateMedium(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(25);
    } catch {
      // Ignored
    }
  }
}

export function vibrateSuccess(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 30, 20]);
    } catch {
      // Ignored
    }
  }
}

export function vibrateError(): void {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([40, 40, 40]);
    } catch {
      // Ignored
    }
  }
}
