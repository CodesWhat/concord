import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownProps {
  content: string;
}

const components: Components = {
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,

  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),

  em: ({ children }) => <em>{children}</em>,

  del: ({ children }) => (
    <del className="line-through text-text-muted">{children}</del>
  ),

  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const isInline = !className;

    if (isInline) {
      return (
        <code
          className="rounded bg-bg-deepest/80 px-1.5 py-0.5 font-mono text-xs text-primary/80"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <code className="block font-mono text-xs" {...props}>
        {match?.[1] && (
          <div className="mb-1 text-xs text-text-muted">{match[1]}</div>
        )}
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="mt-1 overflow-x-auto rounded-md bg-bg-deepest px-3 py-2 font-mono text-xs text-text-secondary">
      {children}
    </pre>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),

  ul: ({ children }) => (
    <ul className="ml-4 list-disc space-y-0.5">{children}</ul>
  ),

  ol: ({ children }) => (
    <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>
  ),

  li: ({ children }) => <li>{children}</li>,

  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 italic text-text-muted">
      {children}
    </blockquote>
  ),

  h1: ({ children }) => (
    <p className="mb-1 text-base font-bold last:mb-0">{children}</p>
  ),

  h2: ({ children }) => (
    <p className="mb-1 text-base font-semibold last:mb-0">{children}</p>
  ),

  h3: ({ children }) => (
    <p className="mb-1 text-sm font-semibold last:mb-0">{children}</p>
  ),

  h4: ({ children }) => (
    <p className="mb-1 text-sm font-semibold last:mb-0">{children}</p>
  ),

  h5: ({ children }) => (
    <p className="mb-1 text-sm font-semibold last:mb-0">{children}</p>
  ),

  h6: ({ children }) => (
    <p className="mb-1 text-sm font-semibold last:mb-0">{children}</p>
  ),

  table: ({ children }) => (
    <div className="my-1 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="border-b border-border">{children}</thead>
  ),

  th: ({ children }) => (
    <th className="px-2 py-1 text-left text-xs font-semibold text-text-secondary">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="border-t border-border/50 px-2 py-1 text-text-primary">
      {children}
    </td>
  ),

  hr: () => <hr className="my-2 border-border" />,

  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="my-1 max-h-80 max-w-full rounded"
    />
  ),

  input: ({ checked, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mr-1.5 align-middle"
      {...props}
    />
  ),
};

export default function Markdown({ content }: MarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
