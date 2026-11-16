import { useEffect, useState } from "react";

/**
 * useLocalStorage: like useState, but the value survives a page refresh.
 *
 * ELI5: a notebook that stays on your desk even after you close the app.
 *
 * Complexity: Time O(n) per write (JSON.stringify of n movies),
 *             Space O(n) for the stored copy.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue; // corrupted or blocked storage -> fall back safely
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: app keeps working in memory */
    }
  }, [key, value]);

  return [value, setValue];
}
