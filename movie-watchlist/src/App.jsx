import useLocalStorage from "./hooks/useLocalStorage.js";
import MovieForm from "./components/MovieForm.jsx";
import MovieCard from "./components/MovieCard.jsx";

/**
 * App: owns the single source of truth (the movies array).
 *
 * ELI5: the librarian. The form hands in new books, each card asks the
 * librarian to change or remove its own book. Children never touch the shelf directly.
 *
 * Complexity (n = number of movies):
 *   add     -> Time O(n) (copy array), Space O(n)
 *   remove  -> Time O(n) (filter),     Space O(n)
 *   rate /
 *   review  -> Time O(n) (map),        Space O(n)
 *   render  -> Time O(n)
 */
export default function App() {
  const [movies, setMovies] = useLocalStorage("movie-watchlist", []);

  // 1) Add a movie
  function addMovie({ title, rating, review }) {
    const movie = { id: crypto.randomUUID(), title, rating, review };
    setMovies((prev) => [movie, ...prev]); // newest first
  }

  // 1) Remove a movie
  function removeMovie(id) {
    setMovies((prev) => prev.filter((m) => m.id !== id));
  }

  // 3) Set the star rating
  function rateMovie(id, rating) {
    setMovies((prev) => prev.map((m) => (m.id === id ? { ...m, rating } : m)));
  }

  // 2) Set / edit the comment review
  function reviewMovie(id, review) {
    setMovies((prev) => prev.map((m) => (m.id === id ? { ...m, review } : m)));
  }

  const totalStars = movies.reduce((sum, m) => sum + m.rating, 0);

  return (
    <main className="app">
      <header>
        <h1>🎬 Movies Watch List</h1>
        <p className="muted">
          {movies.length} movie{movies.length !== 1 && "s"} · {totalStars} ⭐ given in total
        </p>
      </header>

      <MovieForm onAdd={addMovie} />

      {movies.length === 0 ? (
        <p className="empty">Your list is empty. Add the first movie you watched! 🍿</p>
      ) : (
        <ul className="list">
          {movies.map((m) => (
            <MovieCard
              key={m.id}
              movie={m}
              onRate={rateMovie}
              onReview={reviewMovie}
              onRemove={removeMovie}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
