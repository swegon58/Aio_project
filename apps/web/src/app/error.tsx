"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <main>
      <h1>Something went wrong</h1>
      <button onClick={reset}>Try again</button>
      <a href="/app">Back to Aio</a>
    </main>
  );
}
