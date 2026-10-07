'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase, loadMenu, money, num, fd, ST, uploadImage, waNumber, orderLines } from '../../lib/lib';

export default function AdminPage() {
  const [sess, setSess] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSess(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSess(s));
    return () => l.subscription.unsubscribe();
  }, []);
  if (sess === undefined) return <p className="em">Carregando…</p>;
  return sess ? <Panel /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState(''), [pass, setPass] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false); if (error) setMsg('E-mail ou senha incorretos');
  };
  return (
    <div className="login"><img src="/logo.png" alt="" /><h2>Painel do dono</h2>
      <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
      <input placeholder="Senha" type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && go()} />
      {msg && <small style={{ color: '#ff7a5c' }}>{msg}</small>}
      <button className="btn" disabled={busy} onClick={go}>Entrar</button><a href="/">← Voltar ao site</a></div>
  );
}

function Fields({ fields, v, set }) {
  return fields.map(f => {
    const k = f.k;
    if (f.t === 'check') return <label key={k} className="ad"><input type="checkbox" checked={!!v[k]} onChange={e => set(k, e.target.checked)} /><span>{f.l}</span></label>;
    if (f.t === 'multi') return <div key={k}><h4>{f.l}</h4>{f.o.length ? f.o.map(o => <label key={o.v} className="ad"><input type="checkbox" checked={v[k].includes(o.v)} onChange={e => set(k, e.target.checked ? [...v[k], o.v] : v[k].filter(x => x !== o.v))} /><span>{o.l}</span></label>) : <p className="m">Crie adicionais na aba Adicionais.</p>}</div>;
    if (f.t === 'image') return <label key={k}>{f.l}{v[k] && <img className="mi" style={{ height: 120, objectFit: 'contain', background: '#000', borderRadius: 12, marginTop: 6 }} src={v[k]} alt="" />}
      <input type="file" accept="image/*" onChange={async e => { try { set(k, await uploadImage(e.target.files[0], f.max || 900, f.png)); } catch (x) { alert('Falha no envio da imagem: ' + (x.message || x)); } }} /></label>;
    return <label key={k}>{f.l}
      {f.t === 'area' ? <textarea value={v[k] || ''} onChange={e => set(k, e.target.value)} />
        : f.t === 'select' ? <select value={v[k]} onChange={e => set(k, e.target.value)}>{f.o.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
        : <input type={f.t === 'num' ? 'number' : 'text'} step={f.t === 'num' ? '0.01' : undefined} min={f.t === 'num' ? 0 : undefined} value={v[k] ?? ''} onChange={e => set(k, e.target.value)} />}</label>;
  });
}

function FormModal({ title, fields, init, onSave, onClose }) {
  const [v, setV] = useState(init), [busy, setBusy] = useState(false);
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  return (
    <div id="ov" className="on" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet"><button className="x" onClick={onClose}>✕</button>
        <div className="pad"><h3>{title}</h3><Fields fields={fields} v={v} set={set} /></div>
        <div className="bar"><button className="btn" disabled={busy} onClick={async () => { setBusy(true); const ok = await onSave(v); setBusy(false); if (ok) onClose(); }}>Salvar</button></div>
      </div>
    </div>
  );
}

function Settings({ cfg, say, reload }) {
  const [v, setV] = useState(cfg), [np, setNp] = useState('');
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const F = [{ k: 'name', l: 'Nome da lanchonete' }, { k: 'description', l: 'Descrição', t: 'area' }, { k: 'address', l: 'Endereço' }, { k: 'whatsapp', l: 'WhatsApp (com DDD)' }, { k: 'pix_key', l: 'Chave PIX' }, { k: 'hours', l: 'Horário de funcionamento' },
    { k: 'delivery_fee', l: 'Taxa de entrega (R$)', t: 'num' }, { k: 'min_order', l: 'Valor mínimo do pedido (R$)', t: 'num' }, { k: 'social_url', l: 'Link da rede social (Instagram etc.)' }, { k: 'headline', l: 'Mensagem de destaque no site' },
    { k: 'accept_scheduled', l: 'Aceitar pedidos agendados', t: 'check' }, { k: 'logo_url', l: 'Logo', t: 'image', png: true, max: 400 }, { k: 'banner_url', l: 'Imagem de fundo do topo', t: 'image', max: 1400 }];
  const saveCfg = async () => {
    if (!v.name.trim()) return say('Informe o nome');
    const { id, ...rest } = v; const { error } = await supabase.from('settings').update({ ...rest, delivery_fee: num(v.delivery_fee), min_order: num(v.min_order) }).eq('id', 1);
    if (error) return say(error.message); say('Configurações salvas ✔'); reload();
  };
  const savePass = async () => {
    if (np.length < 8) return say('A senha precisa ter ao menos 8 caracteres');
    const { error } = await supabase.auth.updateUser({ password: np }); if (error) return say(error.message); setNp(''); say('Senha alterada ✔');
  };
  return <div className="pad"><Fields fields={F} v={v} set={set} /><button className="btn" onClick={saveCfg}>Salvar configurações</button>
    <h4 style={{ marginTop: 24 }}>Alterar senha do painel</h4><input type="password" placeholder="Nova senha (mín. 8 caracteres)" value={np} onChange={e => setNp(e.target.value)} autoComplete="new-password" />
    <button className="btn" style={{ marginTop: 8 }} onClick={savePass}>Alterar senha</button></div>;
}

function Panel() {
  const [tab, setTab] = useState('orders'), [d, setD] = useState(null), [orders, setOrders] = useState([]), [m, setM] = useState(null), [toast, setToast] = useState(''), [of, setOf] = useState('all');
  const say = t => { setToast(t); setTimeout(() => setToast(''), 3200); };
  const bad = t => { say(t); return false; };
  const reload = useCallback(async () => { setD(await loadMenu()); const { data } = await supabase.from('orders').select('*').order('id', { ascending: false }); setOrders(data || []); }, []);
  useEffect(() => {
    reload();
    const ch = supabase.channel('novos-pedidos').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, p => { say('🔔 Novo pedido #' + p.new.id); reload(); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload]);
  const run = async (q, msg) => { const { error } = await q; if (error) say(error.code === '23503' ? 'Item em uso: remova antes os produtos ligados a ele' : error.message); else { if (msg) say(msg); await reload(); } };
  const toggle = (t, r) => run(supabase.from(t).update({ active: !r.active }).eq('id', r.id));
  const remove = (t, r) => confirm('Excluir definitivamente?') && run(supabase.from(t).delete().eq('id', r.id), 'Excluído ✔');
  const move = (t, list, i, dir) => { const a = [...list], j = i + dir; if (!a[j]) return; [a[i], a[j]] = [a[j], a[i]]; run(Promise.all(a.map((x, k) => supabase.from(t).update({ position: k }).eq('id', x.id))).then(rs => rs.find(r => r.error) || { error: null })); };
  const row = (t, list, r, i, title, subt, img, onEdit, hasActive = true) => (
    <div className="row" key={r.id}>{img !== undefined && <img src={img || '/logo.png'} alt="" />}<div><b>{title}</b><small>{subt}</small></div>
      {hasActive && <label className="sw"><input type="checkbox" checked={r.active} onChange={() => toggle(t, r)} /><i /></label>}
      <button onClick={() => move(t, list, i, -1)}>▲</button><button onClick={() => move(t, list, i, 1)}>▼</button><button onClick={onEdit}>✏️</button><button onClick={() => remove(t, r)}>🗑️</button></div>
  );
  const catOpts = (d?.cats || []).map(c => ({ v: c.id, l: c.name }));

  const saveCat = async v => { if (!v.name.trim()) return bad('Informe o nome'); const q = v.id ? supabase.from('categories').update({ name: v.name.trim() }).eq('id', v.id) : supabase.from('categories').insert({ name: v.name.trim(), position: 999 }); const { error } = await q; if (error) return bad(error.message); await reload(); return true; };
  const saveAdd = async v => { if (!v.name.trim()) return bad('Informe o nome'); const r = { name: v.name.trim(), price: num(v.price), image_url: v.image_url || null, active: v.active }; const { error } = await (v.id ? supabase.from('addons').update(r).eq('id', v.id) : supabase.from('addons').insert({ ...r, position: 999 })); if (error) return bad(error.message); await reload(); return true; };
  const saveProd = async v => {
    if (!v.name.trim()) return bad('Informe o nome'); if (!v.category_id) return bad('Escolha a categoria');
    const r = { name: v.name.trim(), category_id: v.category_id, price: num(v.price), description: v.description || '', image_url: v.image_url || null, active: v.active, addon_min: Math.floor(num(v.addon_min)), addon_max: Math.floor(num(v.addon_max)) };
    if (r.addon_max && r.addon_min > r.addon_max) return bad('O mínimo não pode ser maior que o máximo');
    let id = v.id;
    if (id) { const { error } = await supabase.from('products').update(r).eq('id', id); if (error) return bad(error.message); }
    else { const { data, error } = await supabase.from('products').insert({ ...r, position: 999 }).select('id').single(); if (error) return bad(error.message); id = data.id; }
    await supabase.from('product_addons').delete().eq('product_id', id);
    if (v.addons.length) { const { error } = await supabase.from('product_addons').insert(v.addons.map(a => ({ product_id: id, addon_id: a }))); if (error) return bad(error.message); }
    await reload(); say('Produto salvo ✔'); return true;
  };
  const openProd = p => setM({ title: p ? 'Editar produto' : 'Novo produto', onSave: saveProd, init: p ? { ...p } : { name: '', category_id: d.cats[0]?.id || '', price: 0, description: '', image_url: '', addons: [], addon_min: 0, addon_max: 0, active: true },
    fields: [{ k: 'name', l: 'Nome' }, { k: 'category_id', l: 'Categoria', t: 'select', o: catOpts }, { k: 'price', l: 'Preço (R$)', t: 'num' }, { k: 'description', l: 'Descrição', t: 'area' }, { k: 'image_url', l: 'Foto', t: 'image' },
      { k: 'addons', l: 'Adicionais deste produto', t: 'multi', o: d.addons.map(a => ({ v: a.id, l: `${a.name} (${money(a.price)})` })) }, { k: 'addon_min', l: 'Mínimo obrigatório de adicionais', t: 'num' }, { k: 'addon_max', l: 'Máximo de adicionais (0 = sem limite)', t: 'num' }, { k: 'active', l: 'Produto ativo', t: 'check' }] });
  const openAdd = a => setM({ title: a ? 'Editar adicional' : 'Novo adicional', onSave: saveAdd, init: a ? { ...a } : { name: '', price: 0, image_url: '', active: true }, fields: [{ k: 'name', l: 'Nome' }, { k: 'price', l: 'Preço (R$)', t: 'num' }, { k: 'image_url', l: 'Imagem (opcional)', t: 'image', max: 300 }, { k: 'active', l: 'Ativo', t: 'check' }] });
  const openCat = c => setM({ title: c ? 'Editar categoria' : 'Nova categoria', onSave: saveCat, init: c ? { ...c } : { name: '' }, fields: [{ k: 'name', l: 'Nome (pode usar emoji)' }] });

  const list = orders.filter(o => of === 'all' || (of === 'new' && o.status < 2) || (of === 'sch' && o.scheduled_for && o.status < 5));
  const T = { orders: 'Pedidos', prods: 'Produtos', cats: 'Categorias', adds: 'Adicionais', cfg: 'Configurações' };
  return (
    <>
      <header><img className="lg" src={d?.cfg.logo_url || '/logo.png'} alt="" /><div><b>Painel</b><small>{d?.cfg.name}</small></div><a className="lnk" href="/">Ver site</a><button className="ghost" onClick={() => supabase.auth.signOut()}>Sair</button></header>
      <nav className="tabs" style={{ top: 'calc(69px + env(safe-area-inset-top,0px))' }}>{Object.entries(T).map(([k, v]) => <button key={k} className={tab === k ? 'act' : ''} onClick={() => setTab(k)}>{v}</button>)}</nav>
      <main className="adm">
        {!d ? <p className="em">Carregando…</p> : <>
          {tab === 'orders' && <>
            <div className="chips">{[['all', 'Todos'], ['new', 'Novos'], ['sch', 'Agendados']].map(([k, v]) => <button key={k} className={of === k ? 'act' : ''} onClick={() => setOf(k)}>{v}</button>)}</div>
            {list.length === 0 && <p className="em">Nenhum pedido.</p>}
            {list.map(o => (
              <details className="ord" key={o.id}><summary><b>#{o.id}</b> {o.customer_name} · {money(o.total)}{o.scheduled_for ? ' · 📅 ' + fd(o.scheduled_for) : ''}<span className="st">{ST[o.status]}</span></summary>
                <div className="pad"><small>{fd(o.created_at)} · {o.mode === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}</small>
                  <p>📞 <a style={{ color: 'var(--y)' }} href={`https://wa.me/${waNumber(o.phone)}`} target="_blank" rel="noopener noreferrer">{o.phone}</a></p>
                  {o.address && <p>📍 {o.address}</p>}{o.notes && <p>📝 {o.notes}</p>}{orderLines(o).map((x, i) => <div key={i}>• {x}</div>)}
                  <p>Subtotal {money(o.subtotal)} · Entrega {money(o.delivery_fee)} · <b>Total {money(o.total)}</b></p>
                  <label>Status<select value={o.status} onChange={e => run(supabase.from('orders').update({ status: +e.target.value }).eq('id', o.id), 'Status atualizado ✔')}>{ST.map((s, i) => <option key={i} value={i}>{s}</option>)}</select></label></div></details>
            ))}</>}
          {tab === 'prods' && <><button className="btn" onClick={() => openProd()}>+ Novo produto</button>
            {d.cats.flatMap(c => { const g = d.prods.filter(p => p.category_id === c.id); return g.length ? [<h4 key={'h' + c.id} style={{ margin: '14px 0 0' }}>{c.name}</h4>, ...g.map((p, i) => row('products', g, p, i, p.name, money(p.price), p.image_url, () => openProd(p)))] : []; })}</>}
          {tab === 'cats' && <><button className="btn" onClick={() => openCat()}>+ Nova categoria</button>{d.cats.map((c, i) => row('categories', d.cats, c, i, c.name, `${d.prods.filter(p => p.category_id === c.id).length} produtos`, undefined, () => openCat(c), false))}</>}
          {tab === 'adds' && <><button className="btn" onClick={() => openAdd()}>+ Novo adicional</button>{d.addons.map((a, i) => row('addons', d.addons, a, i, a.name, money(a.price), a.image_url, () => openAdd(a)))}</>}
          {tab === 'cfg' && <Settings cfg={d.cfg} say={say} reload={reload} />}
        </>}
      </main>
      {m && <FormModal {...m} onClose={() => setM(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
