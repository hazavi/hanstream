/** Country evidence wins over language when a generic catalog has shared titles. */
export function isAsianCountry(value: string): boolean {
  return /\b(?:KR|KP|CN|TW|HK|MO|JP|TH|PH|SG|MY|ID|VN|IN|PK|BD|NP|LK|KH|LA|MM|MN|BT)\b|\b(?:korea|china|chinese|taiwan|hong kong|macao|macau|japan|thailand|philippines|singapore|malaysia|indonesia|vietnam|india|pakistan|bangladesh|nepal|sri lanka|cambodia|laos|myanmar|mongolia|bhutan)\b/i.test(value);
}
export function isAsianLanguage(value: string): boolean {
  return /\b(?:Korean|Japanese|Chinese|Mandarin|Cantonese|Thai|Vietnamese|Tagalog|Filipino|Malay|Indonesian|Hindi|Tamil|Telugu|Bengali|Urdu|Burmese|Khmer|Lao|Mongolian|Nepali|Sinhala|ko|ja|zh|th|vi|tl|ms|id|hi|ta|te|bn|ur)\b/i.test(value);
}
export function hasAsianOrigin(country: unknown, language?: unknown): boolean {
  const place = originText(country);
  return place ? isAsianCountry(place) : isAsianLanguage(originText(language));
}
export function originText(value: unknown, depth = 0): string {
  if (depth > 4) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(item => originText(item, depth + 1)).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return originText((value as {name?: unknown}).name, depth + 1);
  return '';
}
