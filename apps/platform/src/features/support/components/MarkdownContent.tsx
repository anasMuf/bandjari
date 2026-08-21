import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import ReactMarkdown, { type Components } from 'react-markdown';

/**
 * Renderer Markdown seragam untuk halaman support (Bantuan, Tentang, FAQ, Legal).
 * - Link internal (diawali "/") memakai TanStack Router Link → navigasi SPA tanpa reload.
 * - Link eksternal dibuka di tab baru dengan rel="noopener noreferrer".
 * - Gaya teks memakai `prose` (plugin @tailwindcss/typography) bernuansa stone.
 */
const markdownComponents: Components = {
  a({ href, children }) {
    if (href?.startsWith('/')) {
      return <Link to={href}>{children}</Link>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-stone max-w-none prose-headings:tracking-tight prose-headings:text-stone-900 prose-a:font-medium prose-a:text-brand-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-stone-900">
      <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
    </div>
  );
}

/** Wrapper kartu putih konsisten untuk halaman konten statis (Bantuan/Tentang/Legal). */
export function MarkdownCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white px-5 py-6 ring-1 ring-stone-900/5 sm:px-8 sm:py-8">
      {children}
    </div>
  );
}
