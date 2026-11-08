import { load } from 'cheerio';
import { isPublishedImage } from './image-utils.mjs';

const text = value => String(value || '').replace(/\s+/g, ' ').trim();
const key = value => text(value).normalize('NFKD').replace(/([A-Za-z])\p{M}+/gu, '$1').normalize('NFKC').toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function https(value, base) {
  try { const url = new URL(value, base); return value && url.protocol === 'https:' && !url.username && !url.password && isPublishedImage(value) ? url.href : undefined; } catch { return undefined; }
}
function internal(value, base, pattern) {
  const url = https(value, base);
  return url && new URL(url).origin === new URL(base).origin && pattern.test(new URL(url).pathname) ? url : undefined;
}

export function parseCatalogSearch(html, base) {
  const $ = load(html);
  return $('article .showname a[href]').map((_, element) => {
    const row = $(element).closest('article');
    const url = internal($(element).attr('href'), base, /^\/shows\/\d+\/[^/]+$/);
    return url ? { title: text($(element).text()), url, year: Number(row.find('.source').text().match(/\b(?:19|20)\d{2}\b/)?.[0]) || undefined, country: row.find('.source img.flag-align').attr('alt'), image: https(row.find('figure img').attr('src'), base), movie: false } : null;
  }).get();
}

/** Accept a filtered listing only when its published form confirms the filters. */
export function parseCatalogPageHasNext(html, base) {
  const $ = load(html), pager = $('.pagination').first();
  const current = Number(pager.find('li.active').first().text()) || 1;
  // The public HTML pager uses zero-based page query values.
  return pager.find('a[href]').toArray().some(element => {
    try { const value = new URL($(element).attr('href'), base).searchParams.get('page'); return value !== null && Number(value) >= current; } catch { return false; }
  });
}
export function parseCatalogBrowse(html, base, filters) {
  const $ = load(html);
  for (const [name, value] of Object.entries(filters)) {
    if (String($('select').filter((_, el) => $(el).attr('name') === name).val() || '') !== String(value)) throw new Error('Catalog filters were not applied.');
  }
  const items = new Map();
  $('.card h2 a[href], article h2 a[href]').each((_, element) => {
    const link = $(element), url = internal(link.attr('href'), base, /^\/shows\/\d+\/[^/]+$/);
    if (!url || !text(link.text())) return;
    const row = link.closest('.card, article');
    items.set(url, {title: text(link.text()), url, movie: false, image: https(row.find('figure img').first().attr('src'), base) || '/file.svg'});
  });
  return {items: [...items.values()], hasNext: parseCatalogPageHasNext(html, base)};
}

export function parseCatalogDetails(html, pageUrl) {
  const $ = load(html);
  const title = text($('h1').first().text());
  if (!title || !$('#general-information').length) throw new Error('Detail page is unavailable.');
  const info = $('h2').filter((_, el) => text($(el).text()) === 'Show Info').parent();
  /** @type {Record<string, string | number>} */
  const meta = {};
  info.children('div').each((_, el) => {
    const row = $(el), label = text(row.children('strong').text()).replace(/:$/, '');
    const content = row.clone(); content.children('strong').remove();
    if (['Network','Schedule','Status','Language','Show Type'].includes(label)) meta[label] = text(content.text());
    if (label === 'Network' || label === 'Web channel') meta.Network = text(content.find('a').first().text()) || text(content.text());
    if (label === 'Episodes ordered') { const count = Number(content.text().match(/\d+/)?.[0]); if (count) meta.Episodes = count; }
  });
  const country = info.find('img.flag-align').first().attr('alt') || $('.generic-info-panel img.flag-align').filter((_, el) => /\/(?:kr|jp|cn|th|tw|hk|ph|sg|my|id|vn|in)\.png/.test($(el).attr('src') || '')).first().attr('alt') || '';
  if (country) meta.Country = country;
  const year = Number(info.find('#year').text().match(/\b(?:19|20)\d{2}\b/)?.[0]) || undefined;
  if (year) meta.Released = year;
  const genres = info.find('strong').filter((_, el) => /^Genres:/.test(text($(el).text()))).parent().find('.divider > span').map((_, el) => text($(el).text())).get();
  if (genres.length) meta.Genre = genres.join(', ');
  const duration = String(meta.Schedule || '').match(/\(~?\s*(\d+) min\)/)?.[1];
  if (duration) meta.Duration = `${duration} min`;
  const rating = Number(info.find('[itemprop="ratingValue"]').text());
  const votes = Number(info.find('[itemprop="ratingCount"]').text());
  if (rating) meta.Rating = rating;
  if (votes) meta['Rating votes'] = votes;
  const aliases = $('.generic-info-panel li');
  const original = aliases.filter((_, el) => /kr\.png|jp\.png|cn\.png|th\.png|tw\.png|hk\.png/.test($(el).html() || '') || /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0e00-\u0e7f]/.test($(el).text())).map((_, el) => text($(el).clone().children().remove().end().text().replace(/\s*\([^)]*\)\s*$/, ''))).get();
  const people = $('h2').filter((_, el) => text($(el).text()) === 'Cast').parent().find('.personbox h2 a[href*="/people/"]').map((_, el) => text($(el).text())).get();
  const cast = $('h2').filter((_, el) => text($(el).text()) === 'Cast').parent().find('.personbox').map((_, el) => ({ name: text($(el).find('h2 a[href*="/people/"]').text()), character: text($(el).find('a[href*="/characters/"]').text()), image: https($(el).find('img').attr('src'), pageUrl) })).get().filter(person => person.name);
  if (people.length) meta.Cast = [...new Set(people)].join(', ');
  const allAliases = aliases.map((_, el) => text($(el).clone().children().remove().end().text().replace(/\s*\([^)]*\)\s*$/, ''))).get();
  return { title, url: pageUrl, year, country, movie: false, image: https($('#main-img img').attr('src'), pageUrl) || '/file.svg', overview: text($('#general-information > article').first().text()), otherNames: original.join(' / ') || undefined, aliases: allAliases, cast, meta, genres, tags: genres, episodesUrl: internal($('a[href$="/episodeguide"]').first().attr('href'), pageUrl, /^\/shows\/\d+\/[^/]+\/episodeguide$/) || `${pageUrl.replace(/\/$/, '')}/episodeguide` };
}

export function parseCatalogEpisodes(html, pageUrl) {
  const $ = load(html), episodes = new Map();
  $('.episodeguide article').each((_, element) => {
    const row = $(element), match = text(row.find('.info').text()).match(/Episode:\s*(\d+)x(\d+)\s*\|\s*Airdate:\s*(.+)/i);
    if (!match || !Number(match[1]) || !Number(match[2])) return;
    const title = text(row.find('h3 a').text());
    const dateText = match[3].match(/\b[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\b/)?.[0];
    const parsedDate = dateText ? Date.parse(dateText + ' 12:00:00 GMT') : Number.NaN;
    const season = Number(match[1]), episode = Number(match[2]);
    episodes.set(`s${season}e${episode}`, { season, episode, title: title && !/^TBA$/i.test(title) ? title : undefined, image: https(row.find('.description img').attr('src'), pageUrl), overview: text(row.find('.description > p').text()), date: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString().slice(0,10) : undefined, ...(!dateText && /TBA|TBD|TBC/i.test(match[3]) ? { upcoming: true } : {}) });
  });
  return [...episodes.values()].sort((a,b) => a.season - b.season || a.episode - b.episode);
}

/** Read only the JSON embedded in the public HTML; no API requests or script evaluation. */
export function parseMediaSearch(html, title) {
  const literal = html.match(/(?:var ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*({.*?});<\/script>/s)?.[1];
  if (!literal) return null;
  let data; try { data = JSON.parse(literal); } catch { return null; }
  const candidates = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.videoRenderer) {
      const video = node.videoRenderer;
      const name = video.title?.runs?.map(run => run.text).join('') || '';
      const channel = video.ownerText?.runs?.map(run => run.text).join('') || '';
      const verified = video.ownerBadges?.some(badge => badge.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED');
      const prefix = name.split(/\||:|[–—]|\s-\s/)[0].replace(/\b(?:(?:official|main|final)\s+)*(?:trailer|teaser)\b.*$/i, '').trim();
      if (/^[\w-]{11}$/.test(video.videoId || '') && key(prefix) === key(title) && /\b(?:trailer|teaser)\b/i.test(name) && !/fan.?made|reaction|explained|review/i.test(name) && verified && /prime video|netflix|kbs|sbs|mbc|tvn|jtbc|viki|viu|disney|iqiyi|wetv|youku|tencent|gmmtv|one31|gmm.?25|channel\s*3|abs.cbn|gma|nhk|fuji|tbs|tv asahi|mango.?tv|sony|zee|jio|hotstar/i.test(channel)) candidates.push({ embedUrl: `https://www.youtube-nocookie.com/embed/${video.videoId}`, thumbnail: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`, title: name, teaser: /teaser/i.test(name) });
    }
    if (Array.isArray(node)) node.forEach(visit); else Object.values(node).forEach(visit);
  }
  visit(data);
  candidates.sort((a,b) => Number(a.teaser) - Number(b.teaser));
  if (!candidates.length) return null;
  const { teaser, ...trailer } = candidates[0]; return trailer;
}
