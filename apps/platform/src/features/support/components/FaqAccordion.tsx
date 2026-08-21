import { ChevronDown } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Parse markdown FAQ: setiap heading level 2 (`## Pertanyaan`) menjadi satu
 * item akordeon; isi di bawahnya (hingga heading berikutnya) adalah jawaban.
 */
export function parseFaq(markdown: string): FaqItem[] {
  const items: FaqItem[] = [];
  let current: FaqItem | null = null;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      current = { question: line.slice(3).trim(), answer: '' };
      items.push(current);
    } else if (current) {
      current.answer += `${line}\n`;
    }
  }

  return items.filter((item) => item.question && item.answer.trim());
}

/**
 * Akordeon FAQ — pakai elemen native <details>/<summary> (accessible tanpa JS).
 * Ikon chevron berputar saat terbuka; jawaban dirender sebagai Markdown.
 */
export function FaqAccordion({ markdown }: { markdown: string }) {
  const items = parseFaq(markdown);

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">FAQ belum tersedia.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <details
          key={item.question}
          className="group rounded-lg bg-white ring-1 ring-stone-900/5 open:ring-brand-700/30"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-stone-900 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-stone-400 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-stone-100 px-5 py-4">
            <MarkdownContent markdown={item.answer} />
          </div>
        </details>
      ))}
    </div>
  );
}
