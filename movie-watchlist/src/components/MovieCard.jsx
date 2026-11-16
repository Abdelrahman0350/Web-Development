import { useState } from "react";
import StarRating from "./StarRating.jsx";

/**
 * MovieCard: shows one movie, lets you re-rate, edit the review, or remove it.
 *
 * Requirement 4: the number of stars is shown with emojis,
 * e.g. rating 3 -> "⭐⭐⭐ (3/5)".
 *
 * Complexity: Time O(1) per render (string repeat is at most 5 chars), Space O(1).
 */
export default function MovieCard({ movie, onRate, onReview, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(movie.review);

  function saveReview() {
    onReview(movie.id, draft.trim());
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(movie.review);
    setEditing(false);
  }

  return (
    <li className="panel card">
      <div className="card-head">
        <h3>{movie.title}</h3>
        <button
          type="button"
          className="danger"
          aria-label={`Remove ${movie.title}`}
          onClick={() => onRemove(movie.id)}
        >
          🗑️ Remove
        </button>
      </div>

      <StarRating value={movie.rating} onChange={(r) => onRate(movie.id, r)} />

      {/* Requirement 4: emoji count of the stars given */}
      <p className="emoji-count">
        {movie.rating > 0 ? (
          <>
            {"⭐".repeat(movie.rating)} <small>({movie.rating}/5)</small>
          </>
        ) : (
          <small>Not rated yet</small>
        )}
      </p>

      {editing ? (
        <div className="review-edit">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="row">
            <button type="button" className="primary" onClick={saveReview}>
              💾 Save
            </button>
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="review">
          {movie.review ? (
            <p>💬 {movie.review}</p>
          ) : (
            <p className="muted">No review yet.</p>
          )}
          <button type="button" onClick={() => setEditing(true)}>
            {movie.review ? "✏️ Edit review" : "💬 Add review"}
          </button>
        </div>
      )}
    </li>
  );
}
