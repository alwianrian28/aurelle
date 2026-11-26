/**
 * Facts about the brand that only Aurelle can supply. Each one is `null` until it is confirmed;
 * the Our Story page shows the block that needs a fact only when the fact is here, so nothing
 * unconfirmed (and no placeholder) is ever shown. To publish a fact, fill it in: no other
 * change is needed.
 *
 * A text can be one string for both languages, or `{ en, id }` when it should be translated.
 */
export type BrandText = string | { en: string; id: string };

export interface BrandStory {
  /** e.g. 2021 */
  foundedYear: number | string | null;
  /** e.g. 'Jakarta' */
  foundedCity: BrandText | null;
  /** The founder's name as it should appear under the quote. */
  founderName: string | null;
  /** A short line in the founder's own words, without quotation marks. */
  founderQuote: BrandText | null;
  /** Two or three sentences on who started Aurelle and why. Shown after "Aurelle began in … in …." */
  originStory: BrandText | null;
  /** Who makes the pieces, e.g. 'a family workshop in Bali'. Completes "…and made by ___." */
  madeBy: BrandText | null;
  /** The stamp on each piece, e.g. '750' or 'AU750'. */
  hallmark: string | null;
}

export const brandStory: BrandStory = {
  foundedYear: null,
  foundedCity: null,
  founderName: null,
  founderQuote: null,
  originStory: null,
  madeBy: null,
  hallmark: null,
};

/** A brand text in the language being shown; an empty or missing text counts as not there. */
export function brandText(value: BrandText | number | null, language: string): string | null {
  if (value === null) return null;
  const text = typeof value === 'object' ? (language.startsWith('id') ? value.id : value.en) : String(value);
  return text.trim() || null;
}
