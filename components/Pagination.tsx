import Link from 'next/link';

export function Pagination({ page, basePath }: { page: number; basePath: string; }) {
  const current = page;
  const prev = current > 1 ? current - 1 : null;
  const next = current + 1; // assume more pages; API doesn't expose total
  return (
    <div className="flex items-center justify-between gap-4 py-6">
      <div>
        {prev ? (
          <Link 
            href={`${basePath}?page=${prev}`} 
            className="glass-btn group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Link>
        ) : (
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100/60 dark:bg-gray-800/30 border border-gray-200/40 dark:border-gray-700/40 text-sm font-medium faint select-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 rounded-lg pagination-current text-sm font-semibold">
          {current}
        </div>
        <span className="faint text-sm">/</span>
        <span className="faint text-sm">?</span>
      </div>
      
      <div>
        <Link 
          href={`${basePath}?page=${next}`} 
          className="glass-btn group"
        >
          Next
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
