"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="markdown-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Mirrors the overflow-x:auto wrapper `pre` gets natively — a bare
          // `<table>` has no scroll affordance of its own on narrow viewports.
          table: ({ ...props }) => (
            <div className="markdown-table-wrap">
              <table {...props} />
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
