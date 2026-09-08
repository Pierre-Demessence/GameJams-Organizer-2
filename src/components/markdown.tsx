import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { cn } from "@/lib/utils";

// Renders untrusted user content as GitHub-Flavored Markdown. rehype-raw parses the
// inline HTML users write (e.g. <br>), and rehype-sanitize immediately strips anything
// unsafe (scripts, event handlers, unsafe URL schemes) so raw HTML cannot inject XSS.
// rehype-slug adds ids to headings so in-page anchor links (#heading) can scroll.
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeSlug]}
        components={{
          a: ({ href, children }) => {
            const isExternal = href ? /^https?:\/\//i.test(href) : false;
            return isExternal ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            ) : (
              <a href={href}>{children}</a>
            );
          },
          // Demote headings so user content never competes with the page's single h1,
          // forwarding the slug id so anchor links still resolve.
          h1: ({ children, id }) => <h2 id={id}>{children}</h2>,
          h2: ({ children, id }) => <h3 id={id}>{children}</h3>,
          h3: ({ children, id }) => <h4 id={id}>{children}</h4>,
          h4: ({ children, id }) => <h5 id={id}>{children}</h5>,
          h5: ({ children, id }) => <h6 id={id}>{children}</h6>,
          h6: ({ children, id }) => <h6 id={id}>{children}</h6>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
