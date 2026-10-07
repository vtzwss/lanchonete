'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, loadMenu, money, unitPrice } from '../lib/lib';

function ProductModal({ p, addons, onClose, onAdd, say }) {
  const ads = p.addons.map(i => addons.find(a => a.id === i)).filter(a => a && a.active);
  const min = Math.min(p.addon_min || 0, ads.length);
  const [sel, setSel] = useState([]), [qty, setQty] = useState(1), [note, setNote] = useState('');
  const toggle = id => {
    if (!sel.includes(id) && p.addon_max && sel.length >= p.addon_max) return say(`Máximo de ${p.addon_max} adicionais`);
    setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  };
  return (
    <div id="ov" className="on" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <button className="x" onClick={onClose}>✕</button>
        <img className="mi" src={p.image_url || '/logo.png'} alt="" />
        <div className="pad">
          <h3>{p.name}</h3><p className="m">{p.description}</p>
          {ads.length > 0 && <>
            <h4>Adicionais <small>{min ? `escolha ao menos ${min}` : 'opcional'}{p.addon_max ? ` · até ${p.addon_max}` : ''}</small></h4>
            {ads.map(a => (
              <label key={a.id} className="ad">
                <input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} />
                {a.image_url && <img src={a.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />}
                <span>{a.name}</span><b>+ {money(a.price)}</b>
              </label>
            ))}
          </>}
          <textarea placeholder="Observação (ex.: sem cebola)" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="bar">
          <div className="qty"><button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button><b>{qty}</b><button onClick={() => setQty(q => Math.min(50, q + 1))}>+</button></div>
          <button className="btn" onClick={() => { if (sel.length < min) return say(`Escolha ao menos ${min} adicional(is)`); onAdd({ pid: p.id, adds: [...sel].sort(), qty, note: note.trim() }); }}>
            Adicionar · {money(unitPrice(p, sel, addons) * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Shop() {
  const router = useRouter();
  const [d, setD] = useState(null), [err, setErr] = useState(''), [cart, setCart] = useState([]), [ready, setReady] = useState(false);
  const [prod, setProd] = useState(null), [open, setOpen] = useState(false), [toast, setToast] = useState(''), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ mode: 'entrega', name: '', phone: '', addr: '', when: '', obs: '' });
  const say = t => { setToast(t); setTimeout(() => setToast(''), 3000); };
  const load = useCallback(() => loadMenu().then(x => { setD(x); setErr(''); }).catch(() => setErr('Não foi possível carregar o cardápio. Tente novamente.')), []);
  useEffect(() => { load(); const t = setInterval(load, 60000); try { setCart(JSON.parse(localStorage.getItem('cart') || '[]')); } catch {} setReady(true); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (ready) localStorage.setItem('cart', JSON.stringify(cart)); }, [cart, ready]);

  if (err) return <p className="em">{err}</p>;
  if (!d) return <p className="em">Carregando cardápio…</p>;
  const c = d.cfg, activeProds = d.prods.filter(p => p.active);
  const lines = cart.map((x, i) => { const p = activeProds.find(y => y.id === x.pid); return p ? { ...x, i, p, u: unitPrice(p, x.adds, d.addons) } : null; }).filter(Boolean);
  const n = lines.reduce((s, l) => s + l.qty, 0), sub = lines.reduce((s, l) => s + l.u * l.qty, 0), fee = f.mode === 'entrega' ? Number(c.delivery_fee) : 0;
  const cats = d.cats.filter(k => activeProds.some(p => p.category_id === k.id));
  const add = it => { setCart(cc => { const k = cc.find(x => x.pid === it.pid && x.note === it.note && x.adds.join() === it.adds.join()); return k ? cc.map(x => (x === k ? { ...x, qty: Math.min(50, x.qty + it.qty) } : x)) : [...cc, it]; }); setProd(null); say('Adicionado ao carrinho ✔'); };
  const chg = (i, dq) => setCart(cc => cc.flatMap((x, j) => (j !== i ? [x] : x.qty + dq <= 0 ? [] : [{ ...x, qty: Math.min(50, x.qty + dq) }])));
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const nowMin = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

  async function send() {
    const ph = f.phone.replace(/\D/g, '');
    if (!lines.length) return say('Carrinho vazio');
    if (f.name.trim().length < 2) return say('Informe seu nome');
    if (ph.length < 10 || ph.length > 13) return say('Informe um telefone válido com DDD');
    if (f.mode === 'entrega' && f.addr.trim().length < 8) return say('Informe o endereço completo');
    if (sub < Number(c.min_order)) return say('Pedido mínimo: ' + money(c.min_order));
    if (f.when && new Date(f.when) < new Date()) return say('Escolha uma data/hora futura');
    setBusy(true);
    const { data, error } = await supabase.rpc('create_order', {
      p_name: f.name.trim(), p_phone: ph, p_mode: f.mode, p_address: f.mode === 'entrega' ? f.addr.trim() : '', p_notes: f.obs.trim(),
      p_scheduled: f.when ? new Date(f.when).toISOString() : null,
      p_items: lines.map(l => ({ product_id: l.pid, qty: l.qty, note: l.note, addons: l.adds })),
    });
    setBusy(false);
    if (error) { load(); return say(error.message); }
    setCart([]); localStorage.removeItem('cart');
    router.push(`/pedido/${data.id}?t=${data.token}`);
  }

  return (
    <>
      <header>
        <img className="lg" src={c.logo_url || '/logo.png'} alt="" />
        <div><b>{c.name}</b><small>🕒 {c.hours}</small></div>
        <button className="cartb" onClick={() => setOpen(true)} aria-label="Carrinho">🛒<i>{n}</i></button>
      </header>
      <section className="hero" style={c.banner_url ? { backgroundImage: `linear-gradient(#000a,#000d),url(${c.banner_url})` } : undefined}>
        <h1>{c.headline}</h1><p>{c.description}</p>{c.address && <small>📍 {c.address}</small>}
      </section>
      <nav className="tabs">{cats.map(k => <button key={k.id} onClick={() => document.getElementById('c' + k.id)?.scrollIntoView({ behavior: 'smooth' })}>{k.name}</button>)}</nav>
      <main>
        {cats.length === 0 && <p className="em">Cardápio em breve.</p>}
        {cats.map(k => (
          <div key={k.id}>
            <h2 id={'c' + k.id}>{k.name}</h2>
            <div className="grid">
              {activeProds.filter(p => p.category_id === k.id).map(p => (
                <article key={p.id} className="card" onClick={() => setProd(p)}>
                  <img src={p.image_url || '/logo.png'} alt="" className={p.image_url ? '' : 'ph'} />
                  <div><b>{p.name}</b><p>{p.description}</p><strong>{money(p.price)}</strong>
                    {p.addons.some(a => d.addons.find(x => x.id === a && x.active)) && <small className="m">+ adicionais disponíveis</small>}</div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </main>
      <footer>{c.social_url && <a href={c.social_url} target="_blank" rel="noopener noreferrer">Redes sociais</a>}<a href="/admin">Área do dono</a></footer>
      {n > 0 && <button className="fab" onClick={() => setOpen(true)}>Ver carrinho · {n} {n > 1 ? 'itens' : 'item'} · {money(sub)}</button>}
      {prod && <ProductModal p={prod} addons={d.addons} onClose={() => setProd(null)} onAdd={add} say={say} />}
      {open && (
        <div id="ov" className="on" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet">
            <button className="x" onClick={() => setOpen(false)}>✕</button>
            <div className="pad"><h3>Seu carrinho</h3>
              {!lines.length && <p className="em">Seu carrinho está vazio.</p>}
              {lines.map(l => (
                <div className="line" key={l.i}>
                  <div><b>{l.p.name}</b>
                    {l.adds.map(a => <small className="m" key={a} style={{ display: 'block' }}>+ {d.addons.find(x => x.id === a)?.name}</small>)}
                    {l.note && <small className="m" style={{ display: 'block' }}>“{l.note}”</small>}<small>{money(l.u)} cada</small></div>
                  <div className="qty"><button onClick={() => chg(l.i, -1)}>−</button><b>{l.qty}</b><button onClick={() => chg(l.i, 1)}>+</button></div>
                  <b>{money(l.u * l.qty)}</b><button className="ghost" onClick={() => chg(l.i, -99)} aria-label="Remover">🗑️</button>
                </div>
              ))}
              {lines.length > 0 && <>
                <div className="seg">
                  <button className={f.mode === 'entrega' ? 'act' : ''} onClick={() => set('mode', 'entrega')}>🛵 Entrega</button>
                  <button className={f.mode === 'retirada' ? 'act' : ''} onClick={() => set('mode', 'retirada')}>🏪 Retirada</button>
                </div>
                <label>Nome<input value={f.name} onChange={e => set('name', e.target.value)} autoComplete="name" /></label>
                <label>WhatsApp / telefone<input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="(69) 99999-9999" autoComplete="tel" /></label>
                {f.mode === 'entrega' && <label>Endereço completo<input value={f.addr} onChange={e => set('addr', e.target.value)} placeholder="Rua, número, bairro, referência" /></label>}
                {c.accept_scheduled && <label>Agendar para (opcional)<input type="datetime-local" min={nowMin} value={f.when} onChange={e => set('when', e.target.value)} /></label>}
                <label>Observações do pedido<textarea maxLength={300} value={f.obs} onChange={e => set('obs', e.target.value)} /></label>
                <div className="tot"><span>Subtotal</span><span>{money(sub)}</span></div>
                {f.mode === 'entrega' && <div className="tot"><span>Taxa de entrega</span><span>{money(fee)}</span></div>}
                <div className="tot b"><span>Total</span><span>{money(sub + fee)}</span></div>
                {Number(c.min_order) > 0 && <small className="m">Pedido mínimo: {money(c.min_order)}</small>}
              </>}
            </div>
            {lines.length > 0 && <div className="bar"><button className="btn" disabled={busy} onClick={send}>{busy ? 'Enviando…' : `Finalizar pedido · ${money(sub + fee)}`}</button></div>}
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
