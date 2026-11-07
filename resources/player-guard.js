/* Fixed, local protection code. It does not read credentials or communicate with the app. */
(() => {
  const stop = () => null;
  for (const [name, value] of [['open', stop], ['close', () => {}], ['print', () => {}]]) {
    try { Object.defineProperty(window, name, {value, writable:false, configurable:false}); } catch {}
  }
  const preventNewTab = event => {
    const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (anchor && (anchor.target.toLowerCase() === '_blank' || event.type === 'auxclick')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  document.addEventListener('click', preventNewTab, true);
  document.addEventListener('auxclick', preventNewTab, true);
  // Keep selectors limited to advertising widgets. Never hide generic overlays,
  // video controls, subtitles, loading indicators, or verification challenges.
  const style = document.createElement('style');
  style.id = 'hanstream-player-protection';
  style.textContent = `
    .adsbygoogle,[data-ad-slot],[data-ad-client],.adsterra-ad,[id^="adsterra-"],
    .ad-overlay,.ads-overlay,.video-ad-overlay,.vjs-ad-container,
    #ad-overlay,#ad-container,#ads-container,[data-ad-overlay],
    iframe[title="Advertisement" i],iframe[title="Advertising" i]
    {display:none!important;pointer-events:none!important}
    div:empty[style*="z-index: 2147483646"],
    div:empty[style*="z-index:2147483646"]
    {pointer-events:none!important}
  `;
  const addStyle = () => {
    if (!style.isConnected) (document.head || document.documentElement)?.append(style);
  };
  // A player can replace <head> after initial navigation. Reuse the same element
  // and coalesce mutations instead of repeatedly scanning the entire document.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (style.isConnected || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; addStyle(); });
  });
  observer.observe(document, {childList:true, subtree:true});
  addStyle();
})();
