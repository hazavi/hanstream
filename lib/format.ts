export function formatRelativeTime(value: string): string {
  if (!value || /ago|trending/i.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString();
}

export function formatEpisodeLabel(id: string): string {
  const match = /^s(\d+)e(\d+(?:\.\d+)?)$/i.exec(id);
  if (!match) return `Episode ${id}`;
  return Number(match[1]) > 1 ? `Season ${Number(match[1])}, Episode ${Number(match[2])}` : `Episode ${Number(match[2])}`;
}
