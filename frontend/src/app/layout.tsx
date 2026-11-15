import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { CitationModal } from '@/components/citation-modal';

export const metadata: Metadata = {
  title: 'KnowledgeAI – Enterprise Knowledge Base AI Assistant',
  description: 'Production-ready enterprise RAG with multi-tenant architecture, pgvector, and low-hallucination streaming AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-50">
        <Providers>
          {children}
          <CitationModal />
        </Providers>
      </body>
    </html>
  );
}
