import url from '../data/idRegions.json?url';

/**
 * Indonesia's provinces, the cities and regencies in each, and every city's postal codes with
 * the district (kecamatan) a code belongs to: province -> city -> [code, district][].
 * A city and the regency of the same name (Bandung) are one entry; the district tells them apart.
 */
export type IdRegions = Record<string, Record<string, [code: string, district: string][]>>;

let cache: Promise<IdRegions | null> | undefined;

/** The list is a file of its own, fetched the first time an Indonesian address is filled in.
 * `null` when it cannot be had: the form then takes the three fields as typed text. */
export function loadIdRegions(): Promise<IdRegions | null> {
  cache ??= fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<IdRegions>) : null))
    .catch(() => null)
    .then((data) => { if (!data) cache = undefined; return data; });
  return cache;
}
