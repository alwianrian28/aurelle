import { useState } from 'react';
import { api } from './api';
import { Icon, Pill, Thumb, Toggle, UploadButton } from './ui';
import { CATEGORY, isMediaSrc, plural, saveError, shopUrl } from './lib';
import type { AdminProduct, Catalog, Collection, Go, Route, SetCatalog } from './types';

type Notice = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Collections: curated groups of products, each with a story and a banner, shown on the
 * shop's Collections page in the order set here. `#/collections/new` and
 * `#/collections/<id>` open the editor; without an id this is the list.
 */
export default function Collections({ collections, products, loaded, setCatalog, route, go }: {
  collections: Collection[]; products: AdminProduct[]; loaded: boolean; setCatalog: SetCatalog; route: Route; go: Go;
}) {
  const [notice, setNotice] = useState<Notice>(null);

  if (route.id) {
    const collection = collections.find((c) => c.id === route.id);
    if (route.id !== 'new' && !collection) return <p className="empty" role={loaded ? 'alert' : undefined}>{loaded ? 'This collection no longer exists.' : 'Loading…'}</p>;
    return <Editor collection={collection} products={products} setCatalog={setCatalog} go={go} />;
  }

  const setActive = async (c: Collection, active: boolean) => {
    const res = await api<Catalog>(`/admin/collections/${c.id}`, { method: 'PATCH', body: { active } });
    if (res.ok) setCatalog(res.data);
    setNotice(res.ok ? { tone: 'ok', text: `${c.name.en} is now ${active ? 'visible in' : 'hidden from'} the store.` } : { tone: 'error', text: saveError(res.error) });
  };
  const visible = collections.filter((c) => c.active).length;

  return (
    <>
      <div className="page-head">
        <div><h1>Collections</h1><p>{plural(collections.length, 'collection')} · {visible} visible in store</p></div>
        <div className="page-head__actions"><button type="button" id="collections-add" className="btn btn--primary" onClick={() => go({ view: 'collections', id: 'new' })}><Icon name="plus" />Add collection</button></div>
      </div>
      {notice && <p className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      <section className="card card--flush">
        <div className="table-wrap">
          <table className="table table--cards t-collections">
            <thead><tr><th>Collection</th><th>Products</th><th>Status</th><th>Visible</th><th><span className="sr">Edit</span></th></tr></thead>
            <tbody>
              {collections.map((c) => {
                const live = c.productIds.filter((id) => products.find((p) => p.id === id)?.active).length;
                return (
                  <tr key={c.id} className={c.active ? '' : 'is-off'}>
                    <td><span className="product"><Thumb src={c.banner} size={56} /><span><button type="button" className="table__key" onClick={() => go({ view: 'collections', id: c.id })}>{c.name.en}</button><small>/collections/{c.slug}</small></span></span></td>
                    <td>{c.productIds.length}{live < c.productIds.length && <small>{c.productIds.length - live} hidden from store</small>}</td>
                    <td><Pill tone={!c.active ? 'grey' : live === 0 ? 'amber' : 'green'}>{!c.active ? 'Hidden' : live === 0 ? 'No visible products' : 'Live'}</Pill></td>
                    <td><Toggle id={`collection-active-${c.id}`} checked={c.active} label={`${c.name.en} visible in store`} onChange={(next) => void setActive(c, next)} /></td>
                    <td className="end"><button type="button" className="link" id={`edit-${c.id}`} onClick={() => go({ view: 'collections', id: c.id })}>Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {collections.length === 0 && <p className="empty">{loaded ? 'No collections yet. Add one to group products around a story.' : 'Loading…'}</p>}
        </div>
      </section>
    </>
  );
}

/** One collection: name, story in both languages, banner, visibility, and its products in order. */
function Editor({ collection, products, setCatalog, go }: { collection: Collection | undefined; products: AdminProduct[]; setCatalog: SetCatalog; go: Go }) {
  const [name, setName] = useState(collection?.name.en ?? '');
  const [storyEn, setStoryEn] = useState(collection?.story.en ?? '');
  const [storyId, setStoryId] = useState(collection?.story.id ?? '');
  const [banner, setBanner] = useState(collection?.banner ?? '');
  const [active, setActive] = useState(collection?.active ?? true);
  const [ids, setIds] = useState<string[]>(collection?.productIds ?? []);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const nameOk = name.trim().length >= 2;
  const bannerOk = banner.trim() === '' || isMediaSrc(banner.trim());
  const dirty = !collection
    ? name !== '' || storyEn !== '' || storyId !== '' || banner !== '' || ids.length > 0
    : name.trim() !== collection.name.en || storyEn.trim() !== collection.story.en || storyId.trim() !== collection.story.id || banner.trim() !== collection.banner
      || active !== collection.active || ids.join() !== collection.productIds.join();

  const save = async () => {
    setTried(true);
    if (!nameOk || !bannerOk || busy) return;
    setBusy(true);
    const body = { nameEn: name, nameId: name, storyEn, storyId, active, productIds: ids };
    const res = collection
      ? await api<Catalog>(`/admin/collections/${collection.id}`, { method: 'PATCH', body: { ...body, banner: banner.trim() } })
      : await api<Catalog & { id: string }>('/admin/collections', { body: { ...body, banner: banner.trim() || null } });
    setBusy(false);
    if (!res.ok) { setNotice({ tone: 'error', text: saveError(res.error) }); return; }
    setCatalog(res.data);
    if (collection) setNotice({ tone: 'ok', text: 'Changes saved.' });
    else go({ view: 'collections', id: (res.data as Catalog & { id: string }).id });
  };
  const remove = async () => {
    if (!collection || busy || !window.confirm(`Delete the collection “${collection.name.en}”? Its products stay in the catalog. This cannot be undone.`)) return;
    setBusy(true);
    const res = await api<Catalog>(`/admin/collections/${collection.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { setNotice({ tone: 'error', text: saveError(res.error) }); return; }
    setCatalog(res.data);
    go({ view: 'collections' });
  };
  const leave = () => { if (!dirty || window.confirm('Leave without saving your changes?')) go({ view: 'collections' }); };
  const move = (i: number, by: number) => { const next = [...ids]; [next[i], next[i + by]] = [next[i + by], next[i]]; setIds(next); setNotice(null); };

  const picked = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is AdminProduct => !!p);
  const q = query.trim().toLowerCase();
  const candidates = products.filter((p) => !ids.includes(p.id) && (!q || p.name.en.toLowerCase().includes(q) || p.name.id.toLowerCase().includes(q)));

  return (
    <form className="edit" onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <div className="page-head">
        <div className="edit__title">
          <button type="button" id="collection-back" className="btn btn--icon" aria-label="Back to collections" onClick={leave}><Icon name="arrowLeft" /></button>
          <div>
            <p><button type="button" className="link link--soft" onClick={leave}>Collections</button> / {collection ? 'Edit' : 'New'}</p>
            <h1>{collection ? collection.name.en : 'Add collection'}{collection && !collection.active && <Pill tone="grey">Hidden</Pill>}</h1>
          </div>
        </div>
        <div className="page-head__actions">
          {collection?.active && <a className="btn" href={new URL(`/collections/${collection.slug}`, shopUrl).href} target="_blank" rel="noreferrer"><Icon name="external" />View in store</a>}
          <button type="submit" id="collection-save" className="btn btn--primary" disabled={busy || (!!collection && !dirty)}>{busy ? 'Saving…' : collection ? 'Save changes' : 'Save collection'}</button>
        </div>
      </div>
      {notice && <p className={`notice notice--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}

      <div className="edit__cols">
        <div className="edit__main">
          <section className="card">
            <h2>Details</h2>
            <label className="field">Collection name
              <input id="collection-name" value={name} onChange={(e) => { setName(e.target.value); setNotice(null); }} maxLength={120} aria-invalid={tried && !nameOk} autoFocus={!collection} />
              {tried && !nameOk && <small className="field__error">Use at least 2 characters.</small>}
            </label>
            <label className="field">Story (English)<textarea id="collection-story-en" rows={3} value={storyEn} onChange={(e) => { setStoryEn(e.target.value); setNotice(null); }} maxLength={1000} /></label>
            <label className="field">Story (Indonesian)<textarea id="collection-story-id" rows={3} value={storyId} onChange={(e) => { setStoryId(e.target.value); setNotice(null); }} maxLength={1000} /></label>
          </section>

          <section className="card">
            <div className="card__head"><h2>Products</h2><span className="muted">{picked.length === 0 ? 'None yet' : `${plural(picked.length, 'product')} · shown in this order`}</span></div>
            {picked.length > 0 && (
              <ol className="picked">
                {picked.map((p, i) => (
                  <li key={p.id}>
                    <span className="picked__n">{i + 1}</span><Thumb src={p.thumb} size={40} />
                    <span className="picked__name">{p.name.en}<small>{CATEGORY[p.category]}{p.active ? '' : ' · hidden from store'}</small></span>
                    <button type="button" className="btn btn--icon btn--ghost" aria-label={`Move ${p.name.en} up`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrowUp" /></button>
                    <button type="button" className="btn btn--icon btn--ghost" aria-label={`Move ${p.name.en} down`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}><Icon name="arrowDown" /></button>
                    <button type="button" className="btn btn--icon btn--ghost" aria-label={`Remove ${p.name.en} from the collection`} onClick={() => { setIds(ids.filter((id) => id !== p.id)); setNotice(null); }}><Icon name="x" /></button>
                  </li>
                ))}
              </ol>
            )}
            <label className="search picked__search"><Icon name="search" /><input id="collection-product-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a product to add" aria-label="Find a product to add" /></label>
            <ul className="candidates">
              {candidates.slice(0, 6).map((p) => (
                <li key={p.id}><Thumb src={p.thumb} size={32} /><span className="picked__name">{p.name.en}<small>{CATEGORY[p.category]}</small></span><button type="button" className="btn" id={`add-${p.id}`} onClick={() => { setIds([...ids, p.id]); setNotice(null); }}><Icon name="plus" />Add</button></li>
              ))}
            </ul>
            {candidates.length > 6 && <p className="muted">{candidates.length - 6} more. Type a name to narrow the list.</p>}
            {candidates.length === 0 && <p className="muted">{q ? 'No other product matches that name.' : 'Every product is already in this collection.'}</p>}
          </section>
        </div>

        <aside className="edit__side">
          <section className="card">
            <h2>Visibility</h2>
            <div className="switch-row">
              <span><strong>{active ? 'Visible in store' : 'Hidden from store'}</strong><small>{active ? 'Listed on the Collections page.' : 'Not listed; its products stay on sale.'}</small></span>
              <Toggle id="collection-active" checked={active} label="Visible in store" onChange={(next) => { setActive(next); setNotice(null); }} />
            </div>
          </section>

          <section className="card">
            <h2>Banner</h2>
            {banner.trim() !== '' && bannerOk && <div className="banner"><Thumb src={banner.trim()} size={120} /></div>}
            <div className="media__actions">
              <UploadButton id="collection-banner-upload" label={banner.trim() ? 'Replace image' : 'Upload image'} limit={1} onUploaded={([src]) => { setBanner(src); setNotice(null); }} />
              {banner.trim() !== '' && <button type="button" className="link link--plain" onClick={() => { setBanner(''); setNotice(null); }}>Remove</button>}
            </div>
            <label className="field">Or an image link
              <input id="collection-banner" value={banner} onChange={(e) => { setBanner(e.target.value); setNotice(null); }} placeholder="https://… or /media/collections/…" maxLength={500} aria-invalid={!bannerOk} />
              {!bannerOk && <small className="field__error">Use an https:// link or a path that starts with /media/.</small>}
            </label>
          </section>

          {collection && (
            <section className="card">
              <h2>Delete</h2>
              <p className="muted">Removes the grouping only. Its products stay in the catalog.</p>
              <button type="button" id="collection-delete" className="btn btn--danger" disabled={busy} onClick={() => void remove()}><Icon name="trash" />Delete collection</button>
            </section>
          )}
        </aside>
      </div>
    </form>
  );
}
