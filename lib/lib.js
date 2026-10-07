import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://invalid.local',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'invalid'
);
export const ST = ['🟡 Pedido recebido','🔵 Pagamento aguardando confirmação','🟢 Pagamento confirmado','🟠 Em preparo','🟣 Saiu para entrega','✅ Finalizado','❌ Cancelado'];
export const money = n => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
export const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : 0; };
export const fd = x => new Date(x).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const waNumber = x => { const d = String(x || '').replace(/\D/g, ''); return d && d.length <= 11 ? '55' + d : d; };
export const unitPrice = (p, ids, addons) => Number(p.price) + ids.reduce((s, i) => { const a = addons.find(x => x.id === i && x.active); return s + (a ? Number(a.price) : 0); }, 0);
export const orderLines = o => o.items.map(i => `${i.qty}x ${i.name}${i.addons?.length ? ' (+ ' + i.addons.map(a => a.name).join(', ') + ')' : ''}${i.note ? ' – ' + i.note : ''}`);
export async function loadMenu() {
  const [s, c, p, a, pa] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('categories').select('*').order('position'),
    supabase.from('products').select('*').order('position'),
    supabase.from('addons').select('*').order('position'),
    supabase.from('product_addons').select('*'),
  ]);
  if (s.error) throw s.error;
  const links = pa.data || [];
  return { cfg: s.data, cats: c.data || [], addons: a.data || [], prods: (p.data || []).map(x => ({ ...x, addons: links.filter(r => r.product_id === x.id).map(r => r.addon_id) })) };
}
export async function uploadImage(file, max = 900, png = false) {
  const img = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const type = png ? 'image/png' : 'image/jpeg', blob = await new Promise(r => c.toBlob(r, type, 0.85));
  const path = `${crypto.randomUUID()}.${png ? 'png' : 'jpg'}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: type, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
