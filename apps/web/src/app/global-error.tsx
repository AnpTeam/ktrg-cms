"use client";

// The last resort (WBS 3.5.5): shown when even the page's frame breaks, where nothing else, including the
// translations, can be trusted. It carries its own <html> and no libraries, and says the same thing in both
// languages. The styles are written out because the stylesheet may be the thing that failed.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#ffffff", color: "#1f1b1a" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px", lineHeight: 1.8 }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>うまく表示できませんでした</h1>
          <p style={{ fontSize: 20, margin: "0 0 24px" }}>こちらの問題です。もう一度お試しください。</p>
          <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>Something went wrong</h2>
          <p style={{ fontSize: 18, margin: "0 0 32px" }}>It is a problem on our side. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ minHeight: 56, width: "100%", fontSize: 20, fontWeight: 700, color: "#ffffff", background: "#8e2a21", border: 0, borderRadius: 12 }}
          >
            もう一度ひらく / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
