import { fetchDrama, DramaResponse } from '../../lib/api';
import { formatRelativeTime } from '../../lib/api';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const data = await fetchDrama(params.slug);
  return { title: (data.result && typeof data.result.title === 'string' ? data.result.title : undefined) || params.slug };
  } catch {
    return { title: params.slug };
  }
}

interface DramaDetail {
  title: string;
  image?: string;
  description?: string;
  other_names?: string;
  episodes?: { id: string; type?: string; time?: string }[];
  meta?: Record<string, unknown>;
}

export default async function DramaDetailPage({ params }: { params: { slug: string } }) {
  const data: DramaResponse = await fetchDrama(params.slug);
  // Build a normalized detail object
  const base = (data.result || {}) as Record<string, unknown>;
  const rootImage = ((): string | undefined => {
    const candidate = (data as unknown as { image?: unknown }).image;
    return typeof candidate === 'string' ? candidate : undefined;
  })();
  const rootMeta = ((): Record<string, unknown> | undefined => {
    const candidate = (data as unknown as { meta?: unknown }).meta;
    return candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : undefined;
  })();
  const detail: DramaDetail = {
    title: typeof base.title === 'string' ? base.title : params.slug.replace(/-/g, ' '),
    image: rootImage || (typeof base.image === 'string' ? base.image : undefined),
    description: typeof base.description === 'string' ? base.description : undefined,
    other_names: typeof base.other_names === 'string' ? base.other_names : undefined,
    episodes: Array.isArray(base.episodes) ? base.episodes as { id: string; type?: string; time?: string }[] : undefined,
    meta: rootMeta || undefined
  };
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Title Section */}
      <div>
  <h1 className="text-3xl lg:text-4xl font-bold heading leading-tight">
          {detail.title}
        </h1>
      </div>
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-shrink-0">
          <div className="w-64 lg:w-72">
      { detail.image ? (
              <Image
        src={detail.image || '/vercel.svg'}
                alt={detail.title}
                width={480}
                height={640}
                className="w-full h-auto rounded-2xl object-cover aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 shadow-lg"
                priority
              />
            ) : null }
          </div>
        </div>
        
        <div className="flex-1 flex flex-col space-y-6">
      {detail.meta && (
            <div className="surface-alt p-6 backdrop-blur-sm">
              <h3 className="text-sm font-semibold heading mb-4 uppercase tracking-wide">
                Drama Information
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {Object.entries(detail.meta).map(([k,v]) => (
                  <div key={k} className="flex flex-col space-y-1">
                    <dt className="font-medium text-secondary text-xs uppercase tracking-wide">
                      {k}
                    </dt>
                    <dd className="text-primary font-medium break-words">
                      {String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          
          {detail.description && (
            <div className="bg-transparent backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-6">
              <div 
                className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-secondary leading-relaxed" 
                dangerouslySetInnerHTML={{ __html: detail.description }} 
              />
            </div>
          )}
          
      {(detail.other_names) && (
            <div className="bg-transparent backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4">
              <p className="text-sm text-secondary leading-relaxed">
        {detail.other_names}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Episodes Section */}
      {detail.episodes && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold heading">
              Episodes ({detail.episodes.length})
            </h2>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {detail.episodes.map((ep: { id: string; type?: string; time?: string }) => {
              const epNum = ep.id.split('/').filter(Boolean).pop();
              return (
                <Link 
                  key={ep.id}
      href={`/${params.slug}/episode/${epNum}`} 
                  className="group block surface rounded-xl p-4 hover:surface-hover hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg glass-surface flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {epNum}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-primary truncate hover:text-accent transition-colors">
                          Episode {epNum}
                        </p>
                        {ep.type && (
                          <span className={`badge ${
                            ep.type === 'SUB' ? 'badge-sub' : 'badge-dub'
                          }`}>
                            {ep.type}
                          </span>
                        )}
                      </div>
                      {ep.time && (
                        <p className="text-xs faint">
                          {formatRelativeTime(ep.time)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
