import slugify from 'slugify';

export function toSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true });
}

export function uniqueSlug(base: string, attempt = 0): string {
  const s = toSlug(base);
  if (attempt === 0) return s;
  return `${s}-${attempt}`;
}
