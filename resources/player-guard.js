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
  const addStyle = () => {
    if (document.getElementById('hanstream-player-protection')) return;
    const style = document.createElement('style'); style.id = 'hanstream-player-protection';
    style.textContent = '.adsbygoogle,[data-ad-slot],[data-ad-client],.adsterra-ad,[id^="adsterra-"]{display:none!important;pointer-events:none!important}';
    (document.head || document.documentElement)?.append(style);
  };
  if (document.documentElement) addStyle();
  else document.addEventListener('DOMContentLoaded', addStyle, {once:true});
})();
