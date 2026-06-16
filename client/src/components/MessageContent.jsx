import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Shared rich renderer for message bodies: GitHub-flavored markdown,
// fenced code blocks, inline code, and LaTeX math ($inline$ and $$block$$).
export default function MessageContent({ children }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ node, ...props }) => <img {...props} className="max-h-64 rounded-lg" />,
          code: ({ node, inline, className, children, ...props }) =>
            inline ? (
              <code className="rounded bg-black/30 px-1" {...props}>{children}</code>
            ) : (
              <pre className="overflow-x-auto rounded-lg bg-black/40 p-3">
                <code className={className} {...props}>{children}</code>
              </pre>
            ),
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
