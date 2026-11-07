/** Display published Latin-script text; never mislabel untranslated text as English. */
export function englishText(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string'
    && Boolean(value.trim())
    && /[\p{Script=Latin}\p{N}]/u.test(value) && !value.includes('\uFFFD')
    && !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(value))?.trim();
}
