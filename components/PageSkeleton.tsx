type PageView = 'home' | 'popular' | 'recently-added' | 'recent-movies' | 'ongoing' | 'ongoing-kshows' | 'search' | 'drama' | 'watch' | 'profile';

function Block({ className = '' }: { className?: string }) {
  return <div className={`loading-placeholder ${className}`} />;
}

export function PageSkeleton({ view = 'home' }: { view?: PageView }) {
  const cards = <div className="homepage-grid">{Array.from({ length: 8 }, (_, index) => <div key={index} className="glass-card overflow-hidden rounded-2xl"><Block className="aspect-[4/5]" /><div className="p-4 space-y-3"><Block className="h-4 w-4/5" /><Block className="h-3 w-1/2" /></div></div>)}</div>;
  return <div role="status" aria-live="polite" className="space-y-6"><span className="sr-only">Loading {view === 'watch' ? 'episode' : view === 'profile' ? 'library' : 'dramas'}...</span><div aria-hidden="true" className="space-y-6">
    {(view === 'drama' || view === 'watch') && <Block className="h-4 w-52" />}
    {view === 'drama' ? <><div className="grid gap-8 sm:grid-cols-[minmax(180px,280px)_1fr]"><Block className="aspect-[2/3] rounded-2xl" /><div className="space-y-5"><Block className="h-10 w-4/5" /><Block className="h-5 w-1/2" /><Block className="h-40 rounded-2xl" /></div></div><Block className="h-12 w-72 rounded-full" /><Block className="h-40 rounded-2xl" /></>
      : view === 'watch' ? <><Block className="h-8 w-64" /><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><Block className="aspect-video rounded-2xl" /><div className="space-y-3">{Array.from({length:5},(_,index)=><Block key={index} className="h-16 rounded-xl" />)}</div></div><Block className="h-12 rounded-xl" /></>
      : view === 'profile' ? <><Block className="h-32 rounded-2xl" /><Block className="h-28 rounded-2xl" />{cards}</>
      : view === 'home' ? <div className="flex flex-col gap-8 lg:flex-row"><div className="min-w-0 flex-1 space-y-6"><Block className="h-8 w-56" />{cards}</div><div className="w-full space-y-5 lg:w-80 xl:w-96">{Array.from({length:3},(_,index)=><Block key={index} className="h-72 rounded-2xl" />)}</div></div>
      : <><Block className="h-8 w-56" />{cards}</>}
  </div></div>;
}
