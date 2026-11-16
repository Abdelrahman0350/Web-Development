import { useState } from "react";
import StarRating from "./StarRating.jsx";

/**
 * MovieForm: add a movie with an optional rating and review (requirements 1-3).
 *
 * ELI5: a small card you fill in, then hand to the shelf.
 *
 * Complexity: Time O(1) per keystroke / submit, Space O(1).
 */
export default function MovieForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const cleanTitle = title.trim();

    // Fail-hard validation: no empty titles.
    if (!cleanTitle) {
      setError("Please enter a movie title.");
      return;
    }

    onAdd({ title: cleanTitle, rating, review: review.trim() });
    setTitle("");
    setRating(0);
    setReview("");
    setError("");
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <h2>Add a movie</h2>

      <label>
        Title
        <input
          type="text"
          value={title}
          placeholder="e.g. Inception"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="field">
        <span>Your rating</span>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <label>
        Review (optional)
        <textarea
          rows={3}
          value={review}
          placeholder="What did you think?"
          onChange={(e) => setReview(e.target.value)}
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="primary">
        ➕ Add to list
      </button>
    </form>
  );
}
