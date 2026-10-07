'use client';
import { useEffect, useState } from 'react';
import { supabase, money, waNumber, orderLines, ST } from '../../../lib/lib';

export default function Pedido({ params }) {
  const [o, setO] = useState(null), [cfg, setCfg] = useState(null), [err, setErr] = useState(''), [toast, setToast] = useState('');
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('t');
    const load = async () => {
      const { data, error } = await supabase.rpc('get_order', { p_id: Number(params.id), p_token: t });
      if (error || !data) setErr('Pedido não encontrado.'); else setO(data);
    };
    supabase.from('settings').select('*').eq('id', 1).single().then(r => setCfg(r.data));
    load(); const i = setInterval(load, 20000); return () => clearInterval(i);
  }, [params.id]);
  if (err) return <main className="done"><p className="em">{err}</p><a className="btn" href="/">Voltar ao cardápio</a></main>;
  if (!o || !cfg) return <p className="em">Carregando…</p>;
  const w = waNumber(cfg.whatsapp);
  const msg = `Olá! Acabei de realizar o pedido #${o.id}.\n${orderLines(o).join('\n')}\nValor total: ${money(o.total)}\nNome: ${o.customer_name}\n${o.mode === 'entrega' ? 'Entrega: ' + o.address : 'Retirada no local'}${o.scheduled_for ? '\nAgendado para: ' + new Date(o.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}${o.notes ? '\nObs: ' + o.notes : ''}\nEstou enviando o comprovante do PIX.`;
  const copy = async () => { try { await navigator.clipboard.writeText(cfg.pix_key); } catch { const i = document.createElement('textarea'); i.value = cfg.pix_key; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); } setToast('Chave PIX copiada ✔'); setTimeout(() => setToast(''), 2500); };
  return (
    <>
      <header><img className="lg" src={cfg.logo_url || '/logo.png'} alt="" /><div><b>{cfg.name}</b></div></header>
      <main className="done">
        <div className="ok">✓</div><h2>Pedido #{o.id} recebido!</h2>
        <p className="m">Status: <b style={{ color: 'var(--y)' }}>{ST[o.status]}</b></p>
        <p className="m">Pague via PIX e envie o comprovante pelo WhatsApp.</p>
        <div className="box">
          {orderLines(o).map((l, i) => <div className="tot" key={i}><span>{l}</span></div>)}<hr style={{ borderColor: '#2a2a2a', margin: '8px 0' }} />
          <div className="tot"><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
          {Number(o.delivery_fee) > 0 && <div className="tot"><span>Entrega</span><span>{money(o.delivery_fee)}</span></div>}
          <div className="tot b"><span>Total</span><span>{money(o.total)}</span></div>
        </div>
        <div className="box"><small className="m">Chave PIX</small>
          <code>{cfg.pix_key || 'Chave ainda não configurada — fale com a lanchonete'}</code>
          {cfg.pix_key && <button className="btn" onClick={copy}>📋 Copiar chave PIX</button>}</div>
        <a className={'btn wa ' + (w ? '' : 'dis')} href={w ? `https://wa.me/${w}?text=${encodeURIComponent(msg)}` : undefined} target="_blank" rel="noopener noreferrer">💬 Enviar comprovante no WhatsApp</a><br />
        <a className="ghost" href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>Fazer novo pedido</a>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
