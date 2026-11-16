import { useState } from "react";

const MAX_STARS = 5;

/**
 * StarRating: clickable stars (requirement 3).
 *
 * ELI5: five light bulbs in a row. Click the 3rd bulb and bulbs 1-3 light up.
 *
 * Props:
 *   value    - current rating, 0..5 (0 = not rated)
 *   onChange - called with the new rating; omit it for a read-only display
 *
 * Complexity: Time O(MAX_STARS) = O(1) per render, Space O(1).
 */
export default function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const readOnly = typeof onChange !== "function";
  const shown = hover || value; // preview on hover, otherwise the saved value

  return (
    <div
      className="stars"
      role="radiogroup"
      aria-label="Star rating"
      onMouseLeave={() => setHover(0)}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const n = i + 1;
        const active = n <= shown;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`star ${active ? "on" : "off"}`}
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)}
            // clicking the same star again clears the rating
            onClick={() => onChange(value === n ? 0 : n)}
          >
            {active ? "⭐" : "☆"}
          </button>
        );
      })}
    </div>
  );
}
