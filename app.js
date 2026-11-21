'use strict';

/* ---------- Grundlagen ---------- */
const KEY = 'lavendel-v1';
const VERSION = 11;
const MEALS = [
  { k: 'fr', n: 'Frühstück', i: 'ti-coffee' },
  { k: 'mi', n: 'Mittagessen', i: 'ti-salad' },
  { k: 'ab', n: 'Abendessen', i: 'ti-soup' },
  { k: 'sn', n: 'Snacks', i: 'ti-cookie' },
];
const TIMES = ['morgens', 'mittags', 'abends', 'zur Nacht', 'bei Bedarf'];
const sortedMedis = () => S.medis.slice().sort((a, b) => (TIMES.indexOf(a.time) + 1 || 99) - (TIMES.indexOf(b.time) + 1 || 99));
// Alle Nährstoffe, die die App kennt (dha = Omega-3 DHA/EPA, kommt nur aus Supplements)
const NUTS = ['kcal', 'p', 'c', 'f', 'fib', 'fe', 'ca', 'zn', 'b12', 'd', 'jod', 'se', 'mg', 'fol', 'ala', 'b2', 'dha'];
const SUPP_NUTS = [['b12', 'Vitamin B12', 'µg'], ['d', 'Vitamin D', 'µg'], ['jod', 'Jod', 'µg'], ['dha', 'Omega-3 DHA/EPA', 'mg'],
  ['fe', 'Eisen', 'mg'], ['zn', 'Zink', 'mg'], ['ca', 'Calcium', 'mg'], ['se', 'Selen', 'µg'], ['mg', 'Magnesium', 'mg']];

// Schweizer Nährwertdatenbank (foods-db.js)
const DB = DB_FOODS.map(r => {
  const n = {};
  DB_KEYS.forEach((k, i) => { if (r[4 + i] != null) n[k] = r[4 + i]; });
  return { id: r[0], name: r[1], cat: r[2], s: r[3], n, u: [], db: true, ml: /getränk|säfte|kaffee|\btee\b|trinkwasser/i.test(r[2]) };
});
const DB_BY_ID = Object.fromEntries(DB.map(f => [f.id, f]));
const MAPPED = new Set(Object.values(BASE_MAP));
const DB_SHOWN = DB.filter(f => !MAPPED.has(f.id)); // Einträge der Startliste nicht doppelt zeigen

// Startliste: eigene Namen und Portionen, Nährwerte aus der Datenbank (falls zugeordnet)
const BASE = RAW_FOODS.map(r => {
  const own = { kcal: r[2], p: r[3], c: r[4], f: r[5], fib: r[6], fe: r[7], ca: r[8], zn: r[9] };
  const sw = DB_BY_ID[BASE_MAP[r[0]]];
  return { id: r[0], name: r[1], n: sw ? { ...own, ...sw.n } : own, u: r[10] || [], ml: !!r[11], starter: true,
    s: sw ? `${sw.name} ${sw.s}` : '' };
});

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: d });
const num = v => {
  let s = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, ''); // "2.360" = 2360
  return parseFloat(s.replace(',', '.'));
};
const fv = n => String(Math.round(Number(n || 0) * 100) / 100).replace('.', ','); // Zahl für Eingabefelder, ohne Tausenderpunkt
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = s => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');

function defState() {
  return {
    profile: { sex: 'w', age: 30, height: 170, weight: 65, act: 1.55, goal: 0 },
    goals: null, waterGoal: 3, bottle: 0.75, setup: false,
    medis: [{ id: 'm1', name: 'Vitamin B12', time: 'morgens' }, { id: 'm2', name: 'Vitamin D3', time: 'morgens' }],
    custom: [], recipes: [], recent: [], lastAmt: {}, days: {}, shop: [], ui: { medisOpen: true },
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      const d = defState();
      const profile = { ...d.profile, ...s.profile };
      if (profile.act > 3) profile.act = profile.act / 1000; // falsch gespeicherte Aktivität (1725 statt 1,725) reparieren
      return { ...d, ...s, profile, ui: { ...d.ui, ...s.ui } };
    }
  } catch (e) { /* ignorieren, Standard verwenden */ }
  return defState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { alert('Speichern hat nicht geklappt. Ist der Speicher voll?'); }
}

let S = load();
let tab = 'heute';
let cur = today();
let sheet = null;
const openMeals = new Set();
const openDays = new Set();
let editMedi = null; // id des Medis, das im Profil gerade bearbeitet wird
const medTime = v => typeof v === 'string' ? v : ''; // ältere Einträge haben nur "true"

function day(k, create) {
  if (S.days[k]) return S.days[k];
  const d = { meals: { fr: [], mi: [], ab: [], sn: [] }, water: 0, medis: {} };
  if (create) S.days[k] = d;
  return d;
}
let recipeView = null; // null = Liste | { mode: 'view', id, scale } | { mode: 'edit', draft }
let addTarget = 'meal'; // 'meal' oder 'recipe' (Zutat für den Rezept-Editor)

function recipeTotals(items) {
  const t = Object.fromEntries(NUTS.map(k => [k, 0])); let g = 0;
  for (const it of items) { g += it.g; for (const k in t) t[k] += (it.n[k] || 0) * it.g / 100; }
  return { t, g };
}
function recipeFood(r) {
  const { t, g } = recipeTotals(r.items), n = {};
  for (const k in t) n[k] = g ? Math.round(t[k] / g * 100 * 100) / 100 : 0;
  return { id: 'r' + r.id, name: r.name, recipe: true, n, ml: false, u: [['Portion', Math.round(g / r.servings) || 1]] };
}
// Standardrezepte (recipes-seed.js) einmalig übernehmen; gelöschte kommen nicht wieder
function seedRecipes() {
  if (typeof SEED_RECIPES === 'undefined') return;
  S.seeded = S.seeded || [];
  let changed = false;
  for (const r of SEED_RECIPES) {
    if (S.seeded.includes(r.sid)) continue;
    S.seeded.push(r.sid); changed = true;
    if (S.recipes.some(x => norm(x.name) === norm(r.name))) continue;
    const items = r.items.map(([name, g, src, o = {}]) => {
      let n = {}, fid;
      if (typeof src === 'string' && src.startsWith('b:')) { const b = BASE.find(f => f.id === src.slice(2)); n = { ...b.n }; fid = b.id; }
      else if (typeof src === 'string') { const d = DB_BY_ID[src]; n = d ? { ...d.n } : {}; }
      else if (src) n = { ...src };
      for (const k of ['kcal', 'p', 'c', 'f']) n[k] = n[k] || 0;
      const it = { id: uid(), fid, name, g, n, ml: !!o.ml };
      if (o.v) it.v = true;
      if (o.u) it.u = o.u.slice();
      if (o.t) it.t = o.t;
      return it;
    });
    S.recipes.push({ id: uid(), sid: r.sid, icon: r.icon, name: r.name, servings: r.servings, meta: r.meta, items,
      notes: r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), tip: r.tip || '' });
  }
  if (changed) save();
}
// Menge einer Zutat als Text, f = Skalierung
const ingAmt = (it, f) => {
  if (it.t && !it.g) return it.t;
  const g = `${fmt(it.g * f, it.g * f < 10 ? 1 : 0)} ${it.ml ? 'ml' : 'g'}`;
  return it.u ? `${fmt(it.u[0] * f, 2)} ${it.u[1]} <small>· ${g}</small>` : g;
};
const allFoods = () => BASE.concat(S.custom, S.recipes.map(recipeFood), DB_SHOWN);
const findFood = id => allFoods().find(f => f.id === id);

function suggest(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const kcal = Math.round((bmr * p.act + Number(p.goal)) / 10) * 10;
  // Pflanzliches Protein wird etwas schlechter verwertet, daher großzügiger: Halten 1,4 / Abnehmen 1,6 / Aufbau 1,7 g pro kg
  const pr = Math.round(p.weight * (p.goal < 0 ? 1.6 : p.goal > 0 ? 1.7 : 1.4));
  const f = Math.round(kcal * 0.3 / 9);
  const c = Math.max(0, Math.round((kcal - pr * 4 - f * 9) / 4));
  return { kcal, p: pr, c, f };
}
// Eigene Ziele: Kalorien, Protein und Fett fest, Kohlenhydrate füllen den Rest auf
const carbRest = g => Math.round((g.kcal - g.p * 4 - g.f * 9) / 4);
const goals = () => {
  if (!S.goals) return suggest(S.profile);
  const { kcal, p, f } = S.goals;
  return { kcal, p, f, c: Math.max(0, carbRest(S.goals)) };
};

function totals(d) {
  const t = Object.fromEntries(NUTS.map(k => [k, 0]));
  for (const m of MEALS) for (const it of d.meals[m.k] || []) for (const k in t) t[k] += (it.n[k] || 0) * it.g / 100;
  return t;
}
const mealKcal = (d, k) => (d.meals[k] || []).reduce((s, it) => s + it.n.kcal * it.g / 100, 0);
function autoMeal() { const h = new Date().getHours(); return h < 11 ? 'fr' : h < 16 ? 'mi' : 'ab'; }
const mealName = k => MEALS.find(m => m.k === k).n;

function dateLabel(k) {
  const off = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  if (k === today()) return 'Heute';
  if (k === off(-1)) return 'Gestern';
  if (k === off(1)) return 'Morgen';
  return new Date(k + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Ansichten ---------- */
function render() {
  const views = { heute: vHeute, suche: vSuche, rezepte: vRezepte, auswertung: vAuswertung, profil: vProfil };
  $('#view').innerHTML = views[tab]();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'suche') bindSearch($('#q'), $('#res'));
}

function vHeute() {
  const d = day(cur), t = totals(d), g = goals();
  const rest = Math.round(g.kcal - t.kcal), over = rest < 0;
  const C = 2 * Math.PI * 52, fr = Math.min(t.kcal / g.kcal || 0, 1);
  const mac = (lbl, v, goal, col) => `<div>${lbl}<div class="bar"><i style="width:${Math.min(v / goal * 100 || 0, 100)}%;background:${col}"></i></div><small>${fmt(v)} / ${fmt(goal)} g</small></div>`;

  const goalB = Math.max(1, Math.ceil(S.waterGoal / S.bottle - 1e-9));
  let bottles = '';
  for (let i = 0; i < Math.max(goalB, d.water); i++)
    bottles += `<button class="btl${i < d.water ? ' on' : ''}" data-act="water" data-i="${i}" aria-label="Flasche ${i + 1}"><i class="ti ti-bottle"></i></button>`;
  if (d.water >= goalB) bottles += `<button class="btl add" data-act="water" data-i="${d.water}" aria-label="Weitere Flasche"><i class="ti ti-plus"></i></button>`;

  const done = S.medis.filter(m => d.medis[m.id]).length;
  const medis = S.medis.length
    ? sortedMedis().map(m => { const v = d.medis[m.id], tm = medTime(v);
        return `<button class="med${v ? ' done' : ''}" data-act="med" data-id="${m.id}"><span class="ck${v ? ' on' : ''}"><i class="ti ti-check"></i></span><span class="grow"><span class="mn">${esc(m.name)}</span>${tm ? `<small class="mt">genommen um ${tm} Uhr</small>` : ''}</span><small>${esc(m.time)}</small></button>`; }).join('')
    : `<p class="note">Noch keine Medis. Du kannst sie im Profil anlegen.</p>`;

  const meals = MEALS.map(m => {
    const items = d.meals[m.k] || [], isOpen = openMeals.has(m.k) && items.length;
    return `<div class="meal"><div class="mrow">
      <button data-act="toggleMeal" data-k="${m.k}"><span class="ic"><i class="ti ${m.i}"></i></span>
        <span class="grow">${m.n}${items.length ? `<small> · ${items.length}</small>` : ''}</span>
        ${items.length ? `<span class="kc">${fmt(mealKcal(d, m.k))} kcal</span><i class="ti ti-chevron-${isOpen ? 'up' : 'down'} chev"></i>` : ''}
      </button>
      <button class="plus" data-act="add" data-k="${m.k}" aria-label="Zu ${m.n} hinzufügen"><i class="ti ti-plus"></i></button>
    </div>${isOpen ? `<div class="items">${items.map(it => `<div class="item"><span class="grow">${esc(it.name)}<small>${fmt(it.g)} ${it.ml ? 'ml' : 'g'}${it.u ? ' · ' + esc(it.u) : ''}</small></span><span class="kc">${fmt(it.n.kcal * it.g / 100)} kcal</span><button class="del" data-act="delItem" data-k="${m.k}" data-id="${it.id}" aria-label="${esc(it.name)} entfernen"><i class="ti ti-x"></i></button></div>`).join('')}</div>` : ''}</div>`;
  }).join('');

  return `
  <div class="top">
    <button class="date" data-act="today">${dateLabel(cur)}</button>
    <div class="nav">
      <button class="iconbtn" data-act="shift" data-n="-1" aria-label="Vorheriger Tag"><i class="ti ti-chevron-left"></i></button>
      <button class="iconbtn" data-act="shift" data-n="1" aria-label="Nächster Tag"><i class="ti ti-chevron-right"></i></button>
    </div>
  </div>
  ${S.setup ? '' : `<button class="card banner" data-act="tab" data-tab="profil"><i class="ti ti-target"></i><span class="grow"><b>Ziele einrichten</b><br><small>Trag kurz Größe, Gewicht und Aktivität ein, dann passt der Vorschlag zu dir.</small></span><i class="ti ti-chevron-right"></i></button>`}
  <div class="ring"><svg viewBox="0 0 120 120" aria-label="${fmt(t.kcal)} von ${fmt(g.kcal)} kcal">
    <circle cx="60" cy="60" r="52" fill="none" stroke="#EEEDFE" stroke-width="8"/>
    <circle cx="60" cy="60" r="52" fill="none" stroke="${over ? '#ED93B1' : '#AFA9EC'}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - fr)}" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .4s"/>
    <text x="60" y="50" text-anchor="middle" font-size="8" fill="#7F77DD">${fmt(t.kcal)} gegessen</text>
    <text x="60" y="68" text-anchor="middle" font-size="19" font-weight="600" fill="#26215C">${fmt(Math.abs(rest))}</text>
    <text x="60" y="80" text-anchor="middle" font-size="8" fill="${over ? '#993556' : '#534AB7'}">${over ? 'kcal drüber' : 'kcal übrig'}</text>
  </svg></div>
  <div class="macros">${mac('Protein', t.p, g.p, '#7F77DD')}${mac('Kohlenhydrate', t.c, g.c, '#ED93B1')}${mac('Fett', t.f, g.f, '#5DCAA5')}</div>

  <div class="card">
    <div class="chead"><span><i class="ti ti-droplet" style="color:var(--water)"></i> Wasser</span><span class="val">${fmt(d.water * S.bottle, 2)} / ${fmt(S.waterGoal, 2)} l</span></div>
    <div class="bottles">${bottles}</div>
    <small>Eine Flasche = ${fmt(S.bottle, 2)} l</small>
  </div>

  <div class="card">
    <button class="chead" data-act="toggleMedis" aria-expanded="${S.ui.medisOpen}"><span><i class="ti ti-pill" style="color:var(--l400)"></i> Medis</span>
      <span class="val">${done} / ${S.medis.length}<i class="ti ti-chevron-${S.ui.medisOpen ? 'up' : 'down'}"></i></span></button>
    ${S.ui.medisOpen ? `<div style="margin-top:4px">${medis}</div>` : ''}
  </div>

  <div class="card">
    <div class="chead"><span>Mahlzeiten</span><span class="val">${fmt(t.kcal)} kcal</span></div>
    ${meals}
  </div>`;
}

function vSuche() {
  return `<h1>Suche</h1>
  <div class="search"><i class="ti ti-search"></i><input id="q" type="search" placeholder="Haferflocken, Tofu, Linsen …" autocomplete="off">${scanBtn}</div>
  <div id="res"></div>`;
}

/* ---------- Einkaufsliste ---------- */
const shopAmt = x => x.g == null ? '' : x.unit ? `${fmt(x.cnt, 2)} ${x.unit}` : x.g >= 1000 ? fmt(x.g / 1000, 2) + (x.ml ? ' l' : ' kg') : fmt(x.g, x.g < 10 ? 1 : 0) + (x.ml ? ' ml' : ' g');
const shopOpen = () => (S.shop || []).filter(x => !x.done).length;
const shopFab = () => { const n = shopOpen();
  return `<div class="fabpad"></div><button class="fab" data-act="openShop" aria-label="Einkaufsliste${n ? `, ${n} offen` : ''}"><i class="ti ti-shopping-cart"></i>${n ? `<span class="badge">${n}</span>` : ''}</button>`; };
function addToShop(r, sc) {
  const f = sc / r.servings; S.shop = S.shop || [];
  const buy = r.items.filter(it => !it.v);
  for (const it of buy) {
    const g = Math.round(it.g * f * 10) / 10, unit = it.u ? it.u[1] : null, cnt = it.u ? it.u[0] * f : null;
    // Gleiche Zutat (gleiche Einheit), die noch nicht abgehakt ist, wird zusammengezählt
    const ex = S.shop.find(x => !x.done && x.g != null && !!x.ml === !!it.ml && (x.unit || null) === unit
      && (it.fid ? x.fid === it.fid : norm(x.name) === norm(it.name)));
    if (ex) {
      ex.g = Math.round((ex.g + g) * 10) / 10; if (unit) ex.cnt = Math.round((ex.cnt + cnt) * 100) / 100;
      if (!ex.from.includes(r.name)) ex.from.push(r.name);
    } else S.shop.push({ id: uid(), fid: it.fid, name: it.name, g, ml: !!it.ml, unit, cnt: unit ? Math.round(cnt * 100) / 100 : null, from: [r.name], done: false });
  }
  const skip = r.items.length - buy.length;
  save(); toast(`${buy.length} Zutaten auf die Einkaufsliste${skip ? ` (${skip} aus dem Vorrat nicht)` : ''}`);
}
function vEinkauf() {
  const L = S.shop || [], open = L.filter(x => !x.done), done = L.filter(x => x.done);
  const row = x => `<div class="shoprow"><button class="med${x.done ? ' done' : ''}" data-act="shopTick" data-id="${x.id}"><span class="ck${x.done ? ' on' : ''}"><i class="ti ti-check"></i></span>
      <span class="grow"><span class="mn">${esc(x.name)}</span>${x.from && x.from.length ? `<small class="mt">${esc(x.from.join(', '))}</small>` : ''}</span>
      <span class="samt">${shopAmt(x)}</span></button>
    <button class="del" data-act="shopDel" data-id="${x.id}" aria-label="${esc(x.name)} entfernen"><i class="ti ti-x"></i></button></div>`;
  return `<div class="top">
      <button class="iconbtn" data-act="shopBack" aria-label="Zurück"><i class="ti ti-chevron-left"></i></button>
      <h1 class="grow" style="margin:4px 0">Einkaufsliste</h1>
      ${open.length ? `<button class="iconbtn" data-act="shopCopy" aria-label="Liste kopieren"><i class="ti ti-copy"></i></button>` : ''}</div>
    <div class="card">
      <div class="codein" style="margin:0"><input id="shopin" placeholder="z. B. Spülmittel, 2 Zitronen" autocomplete="off" aria-label="Eintrag hinzufügen">
        <button class="secondary" data-act="shopAdd" aria-label="Hinzufügen"><i class="ti ti-plus"></i></button></div>
      <button class="secondary" data-act="shopPick" style="margin-top:10px"><i class="ti ti-chef-hat"></i> Rezept hinzufügen</button>
    </div>
    ${L.length ? `<div class="card">
        <div class="chead"><span>Noch zu kaufen</span><span class="val">${open.length}</span></div>
        ${open.map(row).join('') || '<p class="note">Alles im Korb.</p>'}
        ${done.length ? `<div class="chead" style="margin-top:10px"><span>Im Korb</span><span class="val">${done.length}</span></div>${done.map(row).join('')}` : ''}
      </div>
      ${open.length ? `<button class="primary" data-act="shopCopy"><i class="ti ti-copy"></i> Liste kopieren</button>` : ''}
      <div class="shopact">
        ${done.length ? `<button class="secondary" data-act="shopClearDone"><i class="ti ti-checks"></i> Abgehakte entfernen</button>` : ''}
        <button class="secondary" data-act="shopClearAll"><i class="ti ti-trash"></i> Alle entfernen</button>
      </div>`
    : `<div class="card banner"><i class="ti ti-shopping-cart"></i><span class="grow"><b>Deine Einkaufsliste ist leer</b><br><small>Tipp oben etwas ein oder füg ein Rezept hinzu. Die Mengen gleicher Zutaten werden zusammengezählt.</small></span></div>`}`;
}
function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
  const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
  ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  const ok = document.execCommand('copy'); ta.remove();
  return ok ? Promise.resolve() : Promise.reject();
}
function shopAddManual() {
  const inp = $('#shopin'), name = inp.value.trim(); if (!name) return;
  S.shop = S.shop || []; S.shop.push({ id: uid(), name, from: [], done: false });
  save(); render(); $('#shopin').focus();
}

function vRezepte() {
  if (recipeView && recipeView.mode === 'shop') return vEinkauf();
  if (recipeView && recipeView.mode === 'edit') return vRezeptEdit();
  if (recipeView && recipeView.mode === 'view') {
    const r = S.recipes.find(x => x.id === recipeView.id);
    if (r) return vRezeptView(r) + shopFab();
    recipeView = null;
  }
  const list = S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(r => {
    const { t } = recipeTotals(r.items);
    return `<button class="rcard" data-act="openRecipe" data-id="${r.id}"><span class="ic">${r.icon ? `<span class="emo">${esc(r.icon)}</span>` : '<i class="ti ti-chef-hat"></i>'}</span>
      <span class="grow"><b>${esc(r.name)}</b><small>${fmt(r.servings, 1)} Portionen · ${fmt(t.kcal / r.servings)} kcal pro Portion</small></span><i class="ti ti-chevron-right chev"></i></button>`;
  }).join('');
  return `<h1>Rezepte</h1>
  ${list ? `<div class="card" style="padding:2px 14px">${list}</div>`
    : `<div class="card banner"><i class="ti ti-chef-hat"></i><span class="grow"><b>Leg dein erstes Rezept an</b><br><small>Zutaten einmal eintragen, danach mit einem Tipp als Portion ins Tagebuch.</small></span></div>`}
  <button class="primary" data-act="newRecipe"><i class="ti ti-plus"></i> Neues Rezept</button>${shopFab()}`;
}

function nutGrid(t, div) {
  const v = (k, d) => fmt(t[k] / div, d);
  return `<div class="prev"><div><b>${v('kcal', 0)}</b><small>kcal</small></div><div><b>${v('p', 1)}</b><small>Protein</small></div><div><b>${v('c', 1)}</b><small>KH</small></div><div><b>${v('f', 1)}</b><small>Fett</small></div></div>`;
}

// Nummerierte Schritte („1. …“) als schöne Liste, sonst normaler Text
function notesHtml(s) {
  const lines = s.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length && lines.every(l => /^\d+[.)]\s/.test(l)))
    return `<ol class="steps">${lines.map(l => `<li>${esc(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
  return `<p class="notes">${esc(s)}</p>`;
}
function vRezeptView(r) {
  const sc = recipeView.scale || r.servings, f = sc / r.servings, { t } = recipeTotals(r.items);
  return `<div class="top">
      <button class="iconbtn" data-act="recipeBack" aria-label="Zurück zur Liste"><i class="ti ti-chevron-left"></i></button>
      <h1 class="grow" style="margin:4px 0">${r.icon ? esc(r.icon) + ' ' : ''}${esc(r.name)}</h1>
      <button class="iconbtn" data-act="editRecipe" aria-label="Rezept bearbeiten"><i class="ti ti-edit"></i></button></div>
    ${r.meta ? `<p class="rmeta"><i class="ti ti-clock"></i> ${esc(r.meta)}</p>` : ''}
    <div class="card"><h3>Pro Portion</h3>${nutGrid(t, r.servings)}</div>
    <div class="card">
      <div class="chead"><span>Zutaten</span>
        <span class="stepper"><button class="iconbtn" data-act="scale" data-n="-1" aria-label="Weniger Portionen"><i class="ti ti-minus"></i></button>
        <span><b>${fmt(sc, 1)}</b> Port.</span>
        <button class="iconbtn" data-act="scale" data-n="1" aria-label="Mehr Portionen"><i class="ti ti-plus"></i></button></span></div>
      ${sc !== r.servings ? `<small>Umgerechnet von ${fmt(r.servings, 1)} Portionen</small>` : ''}
      ${r.items.map(it => `<div class="ditem ing${it.v ? ' vorrat' : ''}"><span>${esc(it.name)}${it.v ? ' <i class="ti ti-home" title="Vorrat"></i>' : ''}</span><span>${ingAmt(it, f)}</span></div>`).join('')}
      ${r.items.some(it => it.v) ? '<p class="note" style="margin-bottom:0"><i class="ti ti-home"></i> = Vorrat, kommt nicht auf die Einkaufsliste</p>' : ''}
    </div>
    ${r.notes ? `<div class="card"><h3>Zubereitung</h3>${notesHtml(r.notes)}</div>` : ''}
    ${r.tip ? `<div class="card banner tipcard"><i class="ti ti-bulb"></i><span class="grow"><b>Tipp</b><br>${esc(r.tip)}</span></div>` : ''}
    <button class="primary" data-act="logRecipe" data-id="${r.id}"><i class="ti ti-plus"></i> Ins Tagebuch eintragen</button>
    <button class="secondary wide" data-act="shopRecipe" data-id="${r.id}"><i class="ti ti-shopping-cart-plus"></i> ${fmt(sc, 1)} Portionen auf die Einkaufsliste</button>`;
}

function vRezeptEdit() {
  const d = recipeView.draft, { t } = recipeTotals(d.items);
  const rows = d.items.map((it, i) => `<div class="ingrow"><button class="vbtn${it.v ? ' on' : ''}" data-act="togglePantry" data-ri="${i}" aria-label="${it.v ? 'Vorrat, kommt nicht auf die Einkaufsliste' : 'Kommt auf die Einkaufsliste'}" aria-pressed="${!!it.v}"><i class="ti ti-home"></i></button>
      <span class="grow">${esc(it.name)}<small>${it.u ? `${fmt(it.u[0], 2)} ${esc(it.u[1])} · ` : ''}${fmt(it.n.kcal * it.g / 100)} kcal</small></span>
      <input class="gin" data-ri="${i}" inputmode="decimal" value="${fv(it.g)}" aria-label="Menge ${esc(it.name)}"><span class="unit">${it.ml ? 'ml' : 'g'}</span>
      <button class="del" data-act="delIng" data-ri="${i}" aria-label="${esc(it.name)} entfernen"><i class="ti ti-x"></i></button></div>`).join('');
  return `<div class="top">
      <button class="iconbtn" data-act="cancelEdit" aria-label="Abbrechen"><i class="ti ti-chevron-left"></i></button>
      <h1 class="grow" style="margin:4px 0">${d.id ? 'Rezept bearbeiten' : 'Neues Rezept'}</h1></div>
    <div class="card">
      <label class="field">Name<input data-draft="name" value="${esc(d.name)}" placeholder="Linsencurry" autocomplete="off"></label>
      <label class="field">Das Rezept ergibt (Portionen)<input data-draft="servings" inputmode="decimal" value="${fv(d.servings)}"></label>
    </div>
    <div class="card"><div class="chead"><span>Zutaten</span><span class="val">${fmt(t.kcal)} kcal gesamt</span></div>
      ${rows ? rows + '<p class="note" style="margin-bottom:0">Tipp aufs <i class="ti ti-home"></i>, um eine Zutat als Vorrat zu markieren. Vorrat kommt nicht auf die Einkaufsliste.</p>' : '<p class="note">Noch keine Zutaten.</p>'}
      <button class="secondary" data-act="addIng" style="margin-top:8px"><i class="ti ti-plus"></i> Zutat hinzufügen</button>
    </div>
    ${d.items.length ? `<div class="card"><h3>Pro Portion</h3>${nutGrid(t, d.servings || 1)}</div>` : ''}
    <div class="card"><label class="field" style="margin:0">Zubereitung (optional)<textarea data-draft="notes" rows="4" placeholder="Zwiebeln anbraten, Linsen und Kokosmilch dazu …">${esc(d.notes || '')}</textarea></label>
      <p class="note" style="margin:4px 0 10px">Schreibst du die Schritte als „1. …“, „2. …“, werden sie als Liste angezeigt.</p>
      <label class="field" style="margin:0">Tipp (optional)<textarea data-draft="tip" rows="2">${esc(d.tip || '')}</textarea></label></div>
    <p id="rerr" class="err hidden"></p>
    <button class="primary" data-act="saveRecipe">Rezept speichern</button>
    ${d.id ? `<button class="secondary" data-act="delRecipe" style="margin-top:10px"><i class="ti ti-trash"></i> Rezept löschen</button>` : ''}`;
}

function vAuswertung() {
  const d = day(cur), t = totals(d), g = goals(), m = S.profile.sex === 'm';
  const ekcal = t.p * 4 + t.c * 4 + t.f * 9 || 1;
  const prec = v => v >= 100 ? 0 : v >= 10 ? 1 : 2;
  const row = (lbl, v, goal, unit, col) => `<div class="nrow"><div class="lbl"><span>${lbl}</span><span>${fmt(v, prec(v))} / ${fmt(goal, prec(goal))} ${unit}</span></div><div class="bar"><i style="width:${Math.min(v / goal * 100, 100)}%;background:${col}"></i></div></div>`;
  // Nährstoffe aus Essen plus abgehakte Supplements
  const n = { ...t }, fromSupp = {};
  for (const md of S.medis) if (md.nut && md.amt > 0 && d.medis[md.id]) { n[md.nut] = (n[md.nut] || 0) + md.amt; fromSupp[md.nut] = true; }
  const nrow = (k, lbl, goal, unit) => row(lbl + (fromSupp[k] ? ' <i class="ti ti-pill" style="color:var(--l400)" title="inkl. Supplement"></i>' : ''),
    n[k] || 0, goal, unit, (n[k] || 0) >= goal ? '#5DCAA5' : '#AFA9EC');
  const ala = Math.round(g.kcal * 0.005 / 9 * 10) / 10; // 0,5 % der Energie
  return `<h1>Auswertung</h1>
  ${vWoche()}
  <h2 style="margin:22px 0 0">${dateLabel(cur)} im Detail</h2>
  <div class="card"><h3>Energie und Makros</h3>
    ${row('Kalorien', t.kcal, g.kcal, 'kcal', '#AFA9EC')}
    ${row('Protein', t.p, g.p, 'g', '#7F77DD')}${row('Kohlenhydrate', t.c, g.c, 'g', '#ED93B1')}${row('Fett', t.f, g.f, 'g', '#5DCAA5')}
    <p class="note">Energieverteilung: ${fmt(t.p * 4 / ekcal * 100)} % Protein · ${fmt(t.c * 4 / ekcal * 100)} % Kohlenhydrate · ${fmt(t.f * 9 / ekcal * 100)} % Fett</p>
  </div>
  <div class="card"><h3>Kritisch bei veganer Ernährung</h3>
    ${nrow('b12', 'Vitamin B12', 4, 'µg')}${nrow('d', 'Vitamin D', 20, 'µg')}${nrow('jod', 'Jod', 200, 'µg')}
    ${nrow('fe', 'Eisen', m ? 11 : 15, 'mg')}${nrow('zn', 'Zink', m ? 16 : 10, 'mg')}${nrow('ca', 'Calcium', 1000, 'mg')}
    ${nrow('ala', 'Omega-3 (ALA)', ala, 'g')}${nrow('dha', 'Omega-3 (DHA/EPA)', 250, 'mg')}
    ${nrow('se', 'Selen', m ? 70 : 60, 'µg')}${nrow('b2', 'Vitamin B2', m ? 1.4 : 1.1, 'mg')}
  </div>
  <div class="card"><h3>Weitere Nährstoffe</h3>
    ${nrow('fib', 'Ballaststoffe', 30, 'g')}${nrow('mg', 'Magnesium', m ? 350 : 300, 'mg')}${nrow('fol', 'Folat', 300, 'µg')}
    <p class="note">Richtwerte für Erwachsene, orientiert an der DGE. Beim Zink schon an pflanzliche Ernährung angepasst, Vitamin D für den Fall ohne Sonne. Grün heißt: Ziel erreicht.</p>
    <p class="note">Supplements zählen mit (<i class="ti ti-pill"></i>), wenn du bei den Medis einen Nährstoff hinterlegt hast und sie abgehakt sind. Fehlt bei einem Lebensmittel eine Angabe, zählt sie als 0. Die Werte sind daher eher zu niedrig, besonders bei eigenen und gescannten Produkten.</p>
  </div>`;
}

function vWoche() {
  const g = goals(), t0 = today(), list = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = iso(d); list.push({ k, d: day(k), t: totals(day(k)) }); }
  const max = Math.max(g.kcal, ...list.map(x => x.t.kcal)) * 1.08;
  const wd = k => new Date(k + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
  const short = k => new Date(k + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });

  const chart = list.slice().reverse().map(x => `<button class="wcol${x.k === cur ? ' sel' : ''}" data-act="pickDay" data-k="${x.k}" aria-label="${dateLabel(x.k)}: ${fmt(x.t.kcal)} kcal">
      <div class="wbox"><div class="wbar${x.t.kcal > g.kcal ? ' over' : x.k === t0 ? ' today' : ''}" style="height:${x.t.kcal / max * 100}%"></div></div>${wd(x.k)}</button>`).join('');

  const rows = list.map(x => {
    const isOpen = openDays.has(x.k), has = x.t.kcal > 0 || x.d.water > 0 || Object.keys(x.d.medis).length;
    let body = '';
    if (isOpen) {
      const meals = MEALS.filter(m => (x.d.meals[m.k] || []).length).map(m => `<div class="dmeal"><div><span>${m.n}</span><span>${fmt(mealKcal(x.d, m.k))} kcal</span></div>
        ${x.d.meals[m.k].map(it => `<div class="ditem"><span>${esc(it.name)}</span><span>${fmt(it.g)} ${it.ml ? 'ml' : 'g'} · ${fmt(it.n.kcal * it.g / 100)} kcal</span></div>`).join('')}</div>`).join('');
      const medis = sortedMedis().filter(m => x.d.medis[m.id]).map(m => esc(m.name) + (medTime(x.d.medis[m.id]) ? ` (${medTime(x.d.medis[m.id])})` : '')).join(', ');
      body = `<div class="dbody">${meals || '<p class="note" style="margin:0">Keine Mahlzeiten eingetragen.</p>'}
        <div class="dextra"><i class="ti ti-droplet"></i> ${fmt(x.d.water * S.bottle, 2)} l · <i class="ti ti-pill"></i> ${medis || 'keine Medis abgehakt'}</div>
        <div class="dextra">Protein ${fmt(x.t.p)} g · KH ${fmt(x.t.c)} g · Fett ${fmt(x.t.f)} g</div>
        <button class="secondary" data-act="gotoDay" data-k="${x.k}" style="margin-top:10px"><i class="ti ti-edit"></i> Tag bearbeiten</button></div>`;
    }
    return `<div class="drow"><button class="dhead" data-act="toggleDay" data-k="${x.k}" aria-expanded="${isOpen}">
      <span class="grow"><b>${dateLabel(x.k)}</b> ${/^(Heute|Gestern)$/.test(dateLabel(x.k)) ? `<small>${short(x.k)}</small>` : ''}</span>
      <span class="kc">${has ? `${fmt(x.t.kcal)} kcal` : '<small>leer</small>'}</span><i class="ti ti-chevron-${isOpen ? 'up' : 'down'} chev"></i></button>${body}</div>`;
  }).join('');

  const filled = list.filter(x => x.t.kcal > 0);
  const avg = filled.length ? filled.reduce((s, x) => s + x.t.kcal, 0) / filled.length : 0;
  return `<div class="card"><div class="chead"><span>Letzte 7 Tage</span><span class="val">${filled.length ? `Ø ${fmt(avg)} kcal` : ''}</span></div>
    <div class="wchart"><div class="wgoal" style="top:${(1 - g.kcal / max) * 110}px"></div>${chart}</div>
    <small>Gestrichelt: dein Ziel von ${fmt(g.kcal)} kcal. Tipp auf einen Balken für die Details darunter.</small>
  </div>
  <div class="card" style="padding-top:4px;padding-bottom:4px">${rows}</div>`;
}

function vProfil() {
  const p = S.profile, s = suggest(p), g = goals(), own = !!S.goals;
  const opt = (val, lbl, sel) => `<option value="${val}"${String(sel) === String(val) ? ' selected' : ''}>${lbl}</option>`;
  const inp = (bind, lbl, val, unit) => `<label class="field">${lbl}${unit ? ` (${unit})` : ''}<input data-bind="${bind}" inputmode="decimal" value="${fv(val)}"></label>`;
  return `<h1>Profil</h1>
  <div class="card"><h3>Über dich</h3>
    <div class="grid2">
      <label class="field">Geschlecht<select data-bind="profile.sex">${opt('w', 'weiblich', p.sex)}${opt('m', 'männlich', p.sex)}</select></label>
      ${inp('profile.age', 'Alter', p.age, 'Jahre')}
      ${inp('profile.height', 'Größe', p.height, 'cm')}
      ${inp('profile.weight', 'Gewicht', p.weight, 'kg')}
    </div>
    <label class="field">Aktivität<select data-bind="profile.act">
      ${opt(1.2, 'Kaum aktiv – sitzend, wenig Bewegung', p.act)}${opt(1.375, 'Leicht aktiv – 1–2× Sport pro Woche', p.act)}
      ${opt(1.55, 'Mäßig aktiv – 3–4× Sport pro Woche', p.act)}${opt(1.725, 'Sehr aktiv – fast täglich Sport', p.act)}</select></label>
    <label class="field">Ziel<select data-bind="profile.goal">${opt(-400, 'Abnehmen', p.goal)}${opt(0, 'Gewicht halten', p.goal)}${opt(300, 'Zunehmen / Muskelaufbau', p.goal)}</select></label>
    <div class="sugg">Vorschlag: <b>${fmt(s.kcal)} kcal</b> · ${s.p} g Protein · ${s.c} g Kohlenhydrate · ${s.f} g Fett</div>
  </div>

  <div class="card"><h3>Deine Ziele</h3>
    <label class="switch"><input type="checkbox" id="ownGoals"${own ? ' checked' : ''}> Ziele selbst festlegen</label>
    ${own ? `${inp('goals.kcal', 'Kalorien', g.kcal, 'kcal')}<div class="grid2">${inp('goals.p', 'Protein', g.p, 'g')}${inp('goals.f', 'Fett', g.f, 'g')}</div>
      ${carbRest(S.goals) < 0
        ? `<p class="err" style="margin:0">Protein und Fett ergeben schon mehr Kalorien als dein Ziel. Erhöh die Kalorien oder senk Protein bzw. Fett.</p>`
        : `<div class="sugg">Kohlenhydrate: <b>${g.c} g</b>, die füllen automatisch den Rest auf.<br>Verteilung: ${fmt(g.p * 4 / g.kcal * 100)} % Protein · ${fmt(g.c * 4 / g.kcal * 100)} % Kohlenhydrate · ${fmt(g.f * 9 / g.kcal * 100)} % Fett</div>`}`
          : `<p class="note" style="margin:0">Es gilt der Vorschlag von oben. Er passt sich an, wenn du deine Daten änderst.</p>`}
  </div>

  <div class="card"><h3>Wasser</h3>
    <div class="grid2">${inp('S.waterGoal', 'Tagesziel', S.waterGoal, 'l')}${inp('S.bottle', 'Flaschengröße', S.bottle, 'l')}</div>
  </div>

  <div class="card"><h3>Medis</h3>
    <div class="mlist">${sortedMedis().map(m => { const sn = SUPP_NUTS.find(x => x[0] === m.nut);
      return `<div class="med${editMedi === m.id ? ' editing' : ''}"><button class="grow mname" data-act="editMedi" data-id="${m.id}">${esc(m.name)}${sn && m.amt ? `<small>${sn[1]} · ${fmt(m.amt, 2)} ${sn[2]}</small>` : ''}</button><small>${esc(m.time)}</small>
        <button class="del" data-act="editMedi" data-id="${m.id}" aria-label="${esc(m.name)} bearbeiten"><i class="ti ti-edit"></i></button>
        <button class="del" data-act="delMedi" data-id="${m.id}" aria-label="${esc(m.name)} löschen"><i class="ti ti-trash"></i></button></div>`; }).join('') || '<p class="note" style="margin:0">Noch keine Einträge.</p>'}</div>
    ${(() => { const em = S.medis.find(x => x.id === editMedi) || {}; return `
    <h3 style="margin-top:12px">${em.id ? 'Bearbeiten' : 'Neu hinzufügen'}</h3>
    <div class="addmedi"><input id="mn" placeholder="Omega-3 (Algenöl)" autocomplete="off" value="${esc(em.name || '')}"><select id="mt">${TIMES.map(t => `<option${t === em.time ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="addmedi"><select id="mnut"><option value="">Zählt als Nährstoff: nein</option>${SUPP_NUTS.map(x => `<option value="${x[0]}"${x[0] === em.nut ? ' selected' : ''}>${x[1]} (${x[2]})</option>`).join('')}</select>
      <input id="mamt" inputmode="decimal" placeholder="Menge" value="${em.amt ? fv(em.amt) : ''}" aria-label="Menge pro Einnahme"></div>
    <p class="note" style="margin:4px 0 0">Menge pro Einnahme, steht auf der Packung. Bei Vitamin D in IE: 1.000 IE = 25 µg.</p>
    <p id="merr" class="err hidden"></p>
    <button class="secondary" data-act="addMedi"><i class="ti ti-${em.id ? 'check' : 'plus'}"></i> ${em.id ? 'Speichern' : 'Hinzufügen'}</button>
    ${em.id ? '<button class="secondary" data-act="cancelMedi">Abbrechen</button>' : ''}`; })()}
  </div>

  <div class="card"><h3>Deine Daten</h3>
    <p class="note" style="margin:0 0 6px">Alles wird nur auf diesem Gerät gespeichert. Mach ab und zu ein Backup.</p>
    <button class="secondary" data-act="exportData"><i class="ti ti-download"></i> Backup sichern</button>
    <label class="secondary"><i class="ti ti-upload"></i> Backup laden<input id="imp" type="file" accept="application/json,.json" class="hidden"></label>
  </div>
  <p class="note" style="text-align:center">Lavendel · Version ${VERSION}<br>
    Nährwerte: Schweizer Nährwertdatenbank V 7.0, BLV (naehrwertdaten.ch)<br>Produkte: Open Food Facts (ODbL)</p>`;
}

/* ---------- Suche & Bottom-Sheet ---------- */
function results(q) {
  const foods = allFoods().filter(f => addTarget !== 'recipe' || !f.recipe), words = norm(q).split(/\s+/).filter(Boolean);
  let list, head = '', more = 0;
  if (!words.length) {
    // Ohne Suchbegriff: zuletzt genutzt, dann eigene Sachen und die Startliste
    const rec = S.recent.map(findFood).filter(Boolean);
    list = rec.concat(foods.filter(f => !f.db && !S.recent.includes(f.id)).sort((a, b) => a.name.localeCompare(b.name, 'de')));
    head = `<p class="note">Tipp einen Begriff ein, um alle ${fmt(BASE.length + DB_SHOWN.length)} Lebensmittel zu durchsuchen.</p>`;
  } else {
    // Treffer am Wortanfang zuerst, dann Startliste vor eigenen Sachen vor Datenbank, dann kürzere Namen
    const where = x => x.pos === 0 ? 0 : x.pos > 0 ? 1 : 2;
    const rank = f => f.starter ? 0 : f.db ? 2 : 1;
    list = foods.map(f => {
      if (!f._all) f._all = norm(`${f.name} ${f.s || ''}`);
      return { f, all: f._all, pos: norm(f.name).indexOf(words[0]) };
    }).filter(x => words.every(w => x.all.includes(w)))
      .sort((a, b) => where(a) - where(b) || rank(a.f) - rank(b.f) || a.f.name.length - b.f.name.length || a.f.name.localeCompare(b.f.name, 'de'))
      .map(x => x.f);
    if (list.length > 60) { more = list.length - 60; list = list.slice(0, 60); }
  }
  const tag = f => f.recipe ? '<span class="tag">Rezept</span>' : f.src === 'off' ? '<span class="tag">Produkt</span>' : f.custom ? '<span class="tag">eigenes</span>' : '';
  const rows = list.map(f => `<button class="res" data-act="pick" data-id="${f.id}"><span class="grow">${esc(f.name)}${tag(f)}${!words.length && S.recent.includes(f.id) ? '<i class="ti ti-history rec"></i>' : ''}${f.db ? `<small class="cat">${esc(f.cat)}</small>` : ''}</span><small>${fmt(f.n.kcal)} kcal / 100 ${f.ml ? 'ml' : 'g'}</small></button>`).join('');
  return head + (rows || '<p class="empty">Nichts gefunden.</p>') +
    (more ? `<p class="note">… und ${more} weitere. Gib einen genaueren Begriff ein.</p>` : '') +
    `<button class="res new" data-act="newFood"><i class="ti ti-plus"></i><span class="grow">Eigenes Lebensmittel anlegen</span></button>`;
}
function bindSearch(inp, res) {
  const run = () => { res.innerHTML = results(inp.value); };
  inp.addEventListener('input', run);
  run();
}

// Letzter Tag vor dem gewählten Tag, an dem diese Mahlzeit etwas enthielt
function lastMeal(meal) {
  const k = Object.keys(S.days).filter(x => x < cur && (S.days[x].meals[meal] || []).length).sort().pop();
  return k ? { k, items: S.days[k].meals[meal] } : null;
}
function lastMealCard(meal) {
  const last = lastMeal(meal); if (!last) return '';
  const kc = it => it.n.kcal * it.g / 100, sum = last.items.reduce((s, it) => s + kc(it), 0);
  return `<div class="card lastcard"><div class="chead"><span><i class="ti ti-repeat"></i> Wie letztes Mal</span><span class="val">${dateLabel(last.k)}</span></div>
    ${last.items.map(it => `<div class="ditem"><span>${esc(it.name)}</span><span>${fmt(kc(it))} kcal</span></div>`).join('')}
    <div class="ditem lsum"><span>Zusammen</span><span>${fmt(sum)} kcal</span></div>
    <button class="secondary wide" data-act="copyLast"><i class="ti ti-copy"></i> Alles übernehmen</button></div>`;
}
function showSheet(html, cls = '') {
  stopScanner();
  const s = $('#sheet');
  s.innerHTML = `<div class="backdrop" data-act="closeSheet"></div><div class="panel ${cls}" role="dialog"><div class="grab"></div>${html}</div>`;
  s.classList.remove('hidden');
  document.body.classList.add('noscroll');
}
function closeSheet() {
  stopScanner();
  $('#sheet').classList.add('hidden');
  $('#sheet').innerHTML = '';
  document.body.classList.remove('noscroll');
  sheet = null;
  addTarget = 'meal';
}
const closeBtn = `<button class="iconbtn" data-act="closeSheet" aria-label="Schließen"><i class="ti ti-x"></i></button>`;
const scanBtn = `<button class="iconbtn" data-act="scan" aria-label="Barcode scannen"><i class="ti ti-barcode"></i></button>`;

/* ---------- Barcode ---------- */
let scanner = null;
function stopScanner() {
  const s = scanner; scanner = null;
  if (s) s.stop().then(() => s.clear()).catch(() => {});
}
function loadScanLib() {
  if (window.Html5Qrcode) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/html5-qrcode.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
async function openScan(meal) {
  sheet = { mode: 'scan', meal, from: !!sheet };
  showSheet(`<div class="shead">
      ${sheet.from ? `<button class="iconbtn" data-act="back" aria-label="Zurück"><i class="ti ti-chevron-left"></i></button>` : ''}
      <h2 class="grow">Barcode scannen</h2>${closeBtn}</div>
    <div id="reader" class="reader"></div>
    <p id="scmsg" class="note">Kamera wird gestartet …</p>
    <div class="codein"><input id="code" inputmode="numeric" placeholder="Oder Nummer eintippen" autocomplete="off" aria-label="Barcode-Nummer">
      <button class="secondary" data-act="lookup">Suchen</button></div>
    <div id="scres"></div>`);
  try {
    await loadScanLib();
    if (!sheet || sheet.mode !== 'scan') return;
    const F = Html5QrcodeSupportedFormats;
    const s = new Html5Qrcode('reader', { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
    await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 130 } },
      text => { stopScanner(); $('#code').value = text; lookup(text); }, () => {});
    if (!sheet || sheet.mode !== 'scan') { s.stop().catch(() => {}); return; }
    scanner = s;
    $('#scmsg').textContent = 'Halte den Strichcode in den Rahmen.';
  } catch (e) {
    const m = $('#scmsg');
    if (m) m.textContent = 'Kamera nicht verfügbar. Erlaube den Kamerazugriff oder tippe die Nummer unter dem Strichcode ein.';
    const r = $('#reader'); if (r) r.classList.add('hidden');
  }
}
const mg = v => v == null || v === '' ? 0 : Math.round(Number(v) * 1000 * 10) / 10; // g -> mg
function mapOff(code, p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  if (kcal == null) return null;
  const brand = (p.brands || '').split(',')[0].trim();
  let name = (p.product_name_de || p.product_name || 'Unbekanntes Produkt').trim();
  if (brand && !norm(name).includes(norm(brand))) name += ` (${brand})`;
  const u = [];
  if (p.serving_quantity > 0) u.push(['Portion', +p.serving_quantity]);
  if (p.product_quantity > 0) u.push(['Packung', +p.product_quantity]);
  return { id: 'o' + code, code, name, src: 'off', custom: true, u,
    ml: /\d\s*(ml|cl|l)\b/i.test(p.quantity || ''),
    n: { kcal: Math.round(kcal), p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0,
      fib: +n.fiber_100g || 0, fe: mg(n.iron_100g), ca: mg(n.calcium_100g), zn: mg(n.zinc_100g),
      b12: ug(n['vitamin-b12_100g']), d: ug(n['vitamin-d_100g']), jod: ug(n.iodine_100g), se: ug(n.selenium_100g),
      mg: mg(n.magnesium_100g), fol: ug(n.folates_100g ?? n['vitamin-b9_100g']), b2: mg(n['vitamin-b2_100g']),
      ala: +n['alpha-linolenic-acid_100g'] || 0 } };
}
const ug = v => v == null || v === '' ? 0 : Math.round(Number(v) * 1e6 * 100) / 100; // g -> µg
async function lookup(code) {
  code = String(code || '').replace(/\D/g, '');
  const out = $('#scres'); if (!out) return;
  if (!/^\d{8,14}$/.test(code)) { out.innerHTML = '<p class="err">Ein Barcode hat 8 bis 14 Ziffern.</p>'; return; }
  const known = S.custom.find(f => f.code === code);
  if (known) { const meal = sheet.meal; sheet = { mode: 'scan' }; openAmount(known, meal); return; }
  out.innerHTML = '<p class="note">Suche bei Open Food Facts …</p>';
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_de,brands,nutriments,serving_quantity,serving_size,quantity,product_quantity`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = r.status === 404 ? {} : await r.json();
    const food = j.product && mapOff(code, j.product);
    if (!sheet || sheet.mode !== 'scan') return;
    if (!food) {
      sheet.code = code;
      out.innerHTML = `<p class="note">${j.product ? 'Das Produkt ist bekannt, aber ohne Nährwerte.' : 'Dieses Produkt ist noch nicht in Open Food Facts.'} Du kannst es mit den Werten von der Packung selbst anlegen.</p>
        <button class="primary" data-act="newFood">Selbst anlegen</button>`;
      return;
    }
    S.custom.push(food); save();
    const meal = sheet.meal; sheet = { mode: 'scan' };
    openAmount(food, meal);
  } catch (e) {
    if (out.isConnected) out.innerHTML = '<p class="err">Keine Verbindung. Prüf dein Internet und versuch es nochmal.</p>';
  }
}

function openSearch(meal) {
  sheet = { mode: 'search', meal };
  showSheet(`<div class="shead"><h2 class="grow">${addTarget === 'recipe' ? 'Zutat hinzufügen' : mealName(meal)}</h2>${closeBtn}</div>
    ${addTarget === 'recipe' ? '' : lastMealCard(meal)}
    <div class="search"><i class="ti ti-search"></i><input id="sq" type="search" placeholder="Lebensmittel suchen" autocomplete="off">${scanBtn}</div>
    <div id="sres"></div>`, 'tall');
  bindSearch($('#sq'), $('#sres'));
}

function openAmount(food, meal) {
  if (!food) return;
  const base = food.ml ? 'ml' : 'g';
  const units = [[base, 1]].concat(food.u);
  sheet = { mode: 'amount', food, meal, units, from: !!sheet && (sheet.mode === 'search' || sheet.mode === 'scan') };
  // Zuletzt gewählte Menge und Einheit vorauswählen, sonst 1 Portion bzw. 100 g
  const last = (S.lastAmt || {})[food.id], useLast = last && last.ui < units.length && last.q > 0;
  const ui = useLast ? last.ui : food.u.length ? 1 : 0;
  const q0 = useLast ? last.q : ui ? 1 : 100;
  showSheet(`<div class="shead">
      ${sheet.from ? `<button class="iconbtn" data-act="back" aria-label="Zurück"><i class="ti ti-chevron-left"></i></button>` : ''}
      <h2 class="grow">${esc(food.name)}</h2>${closeBtn}</div>
    <div class="amt"><input id="aq" inputmode="decimal" value="${fv(q0)}" aria-label="Menge">
      <select id="au" aria-label="Einheit">${units.map((u, i) => `<option value="${i}"${i === ui ? ' selected' : ''}>${esc(u[0])}${i ? ` (${fmt(u[1])} ${base})` : ''}</option>`).join('')}</select></div>
    <p id="aerr" class="err hidden">Gib eine Menge größer als 0 ein.</p>
    ${addTarget === 'recipe' ? '<div style="height:12px"></div>' : `<div class="chips">${MEALS.map(m => `<button class="chip${m.k === meal ? ' on' : ''}" data-act="setMeal" data-k="${m.k}">${m.n}</button>`).join('')}</div>`}
    <div id="aprev" class="prev"></div>
    <button class="primary" data-act="confirmAdd">${addTarget === 'recipe' ? 'Zum Rezept hinzufügen' : 'Hinzufügen'}</button>`);
  const upd = () => {
    const g = amountGrams();
    $('#aerr').classList.add('hidden');
    const v = k => fmt((food.n[k] || 0) * (g || 0) / 100, k === 'kcal' ? 0 : 1);
    $('#aprev').innerHTML = `<div><b>${v('kcal')}</b><small>kcal</small></div><div><b>${v('p')}</b><small>Protein</small></div><div><b>${v('c')}</b><small>KH</small></div><div><b>${v('f')}</b><small>Fett</small></div>`;
  };
  $('#aq').addEventListener('input', upd);
  $('#au').addEventListener('change', upd);
  upd();
}
function amountGrams() {
  const q = num($('#aq').value), u = sheet.units[+$('#au').value];
  return q > 0 ? q * u[1] : NaN;
}

function openNewFood() {
  const meal = sheet && sheet.meal ? sheet.meal : autoMeal(), code = sheet && sheet.code;
  sheet = { mode: 'new', meal, code };
  const f = (id, lbl, ph) => `<label class="field">${lbl}<input id="${id}" inputmode="decimal" placeholder="${ph}"></label>`;
  showSheet(`<div class="shead"><h2 class="grow">Eigenes Lebensmittel</h2>${closeBtn}</div>
    <label class="field">Name<input id="nf-name" placeholder="Mein Lieblingsmüsli" autocomplete="off"></label>
    <label class="switch"><input type="checkbox" id="nf-ml"> Getränk (Werte pro 100 ml)</label>
    <p class="note" style="margin:0 0 8px">Werte pro 100 g bzw. 100 ml, steht meist hinten auf der Packung.</p>
    <div class="grid2">${f('nf-kcal', 'Kalorien (kcal)', '380')}${f('nf-p', 'Protein (g)', '12')}${f('nf-c', 'Kohlenhydrate (g)', '60')}${f('nf-f', 'Fett (g)', '8')}${f('nf-fib', 'Ballaststoffe (g)', 'optional')}</div>
    <div class="grid2"><label class="field">Portion (optional)<input id="nf-pn" placeholder="Schale" autocomplete="off"></label>${f('nf-pg', 'Portion in g/ml', '60')}</div>
    <p id="nferr" class="err hidden"></p>
    <button class="primary" data-act="saveFood">Speichern und eintragen</button>`);
}

/* ---------- Aktionen ---------- */
const ACT = {
  tab: el => {
    tab = el.dataset.tab;
    // Rezepte-Tab führt immer zur Rezeptliste (nur ein offener Rezept-Entwurf bleibt erhalten)
    if (tab === 'rezepte' && recipeView && recipeView.mode !== 'edit') recipeView = null;
    render(); window.scrollTo(0, 0);
  },
  copyLast: () => {
    const last = lastMeal(sheet.meal); if (!last) return;
    const d = day(cur, true), meal = sheet.meal;
    for (const it of last.items) d.meals[meal].push({ ...JSON.parse(JSON.stringify(it)), id: uid() });
    save(); closeSheet(); openMeals.add(meal);
    if (tab === 'heute') render();
    toast(`${last.items.length} ${last.items.length === 1 ? 'Eintrag' : 'Einträge'} zu ${mealName(meal)} hinzugefügt`);
  },
  shift: el => { const d = new Date(cur + 'T12:00'); d.setDate(d.getDate() + +el.dataset.n); cur = iso(d); render(); },
  today: () => { cur = today(); render(); },
  water: el => { const d = day(cur, true), i = +el.dataset.i; d.water = d.water === i + 1 ? i : i + 1; save(); render(); },
  med: el => {
    const d = day(cur, true), id = el.dataset.id;
    if (d.medis[id]) delete d.medis[id];
    else d.medis[id] = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    save(); render();
  },
  pickDay: el => { cur = el.dataset.k; render(); },
  newRecipe: () => { recipeView = { mode: 'edit', draft: { name: '', servings: 4, items: [], notes: '' } }; render(); window.scrollTo(0, 0); },
  openRecipe: el => { recipeView = { mode: 'view', id: el.dataset.id, scale: null }; render(); window.scrollTo(0, 0); },
  recipeBack: () => { recipeView = null; render(); },
  editRecipe: () => {
    const r = S.recipes.find(x => x.id === recipeView.id);
    recipeView = { mode: 'edit', draft: JSON.parse(JSON.stringify(r)) }; render(); window.scrollTo(0, 0);
  },
  cancelEdit: () => {
    const d = recipeView.draft;
    if ((d.items.length || d.name) && !confirm('Änderungen verwerfen?')) return;
    recipeView = d.id ? { mode: 'view', id: d.id, scale: null } : null; render();
  },
  addIng: () => { addTarget = 'recipe'; openSearch(autoMeal()); },
  togglePantry: el => { const it = recipeView.draft.items[+el.dataset.ri]; it.v = !it.v; render(); },
  delIng: el => { recipeView.draft.items.splice(+el.dataset.ri, 1); render(); },
  saveRecipe: () => {
    const d = recipeView.draft, err = $('#rerr');
    const show = m => { err.textContent = m; err.classList.remove('hidden'); err.scrollIntoView({ block: 'center' }); };
    d.name = (d.name || '').trim();
    if (!d.name) return show('Gib dem Rezept einen Namen.');
    if (!(d.servings > 0)) return show('Gib an, wie viele Portionen das Rezept ergibt.');
    if (!d.items.length) return show('Füg mindestens eine Zutat hinzu.');
    if (d.id) S.recipes = S.recipes.map(r => r.id === d.id ? d : r);
    else { d.id = uid(); S.recipes.push(d); }
    save(); recipeView = { mode: 'view', id: d.id, scale: null }; render(); window.scrollTo(0, 0); toast('Rezept gespeichert');
  },
  delRecipe: () => {
    const d = recipeView.draft;
    if (!confirm(`„${d.name}“ wirklich löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.`)) return;
    S.recipes = S.recipes.filter(r => r.id !== d.id); save(); recipeView = null; render();
  },
  scale: el => {
    const r = S.recipes.find(x => x.id === recipeView.id);
    recipeView.scale = Math.max(1, Math.round((recipeView.scale || r.servings) + +el.dataset.n)); render();
  },
  openShop: () => { recipeView = { mode: 'shop', back: recipeView }; render(); window.scrollTo(0, 0); },
  shopBack: () => { recipeView = recipeView.back || null; render(); window.scrollTo(0, 0); },
  shopTick: el => { const x = S.shop.find(i => i.id === el.dataset.id); if (x) { x.done = !x.done; save(); render(); } },
  shopDel: el => { S.shop = S.shop.filter(i => i.id !== el.dataset.id); save(); render(); },
  shopAdd: () => shopAddManual(),
  shopClearDone: () => { S.shop = S.shop.filter(i => !i.done); save(); render(); toast('Abgehakte entfernt'); },
  shopClearAll: () => { if (!confirm('Die ganze Einkaufsliste leeren?')) return; S.shop = []; save(); render(); },
  shopCopy: () => {
    const open = S.shop.filter(x => !x.done);
    const txt = 'Einkaufsliste\n' + open.map(x => `• ${x.name}${x.g != null ? ' – ' + shopAmt(x) : ''}`).join('\n');
    copyText(txt).then(() => toast('Kopiert – jetzt z. B. in WhatsApp einfügen'), () => toast('Kopieren hat nicht geklappt'));
  },
  shopRecipe: el => { const r = S.recipes.find(x => x.id === el.dataset.id); addToShop(r, recipeView.scale || r.servings); render(); },
  shopPick: () => {
    if (!S.recipes.length) return toast('Du hast noch keine Rezepte');
    showSheet(`<div class="shead"><h2 class="grow">Rezept hinzufügen</h2>${closeBtn}</div>
      <p class="note" style="margin-top:0">Für andere Portionen öffne das Rezept und stell sie dort ein.</p>
      ${S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(r => `<button class="rcard" data-act="shopPickR" data-id="${r.id}"><span class="ic"><i class="ti ti-chef-hat"></i></span>
        <span class="grow"><b>${esc(r.name)}</b><small>${fmt(r.servings, 1)} Portionen · ${r.items.length} Zutaten</small></span><i class="ti ti-plus chev"></i></button>`).join('')}`);
  },
  shopPickR: el => { addToShop(S.recipes.find(x => x.id === el.dataset.id), S.recipes.find(x => x.id === el.dataset.id).servings); closeSheet(); render(); },
  logRecipe: el => openAmount(recipeFood(S.recipes.find(r => r.id === el.dataset.id)), autoMeal()),
  toggleDay: el => { const k = el.dataset.k; openDays.has(k) ? openDays.delete(k) : openDays.add(k); render(); },
  gotoDay: el => { cur = el.dataset.k; tab = 'heute'; render(); window.scrollTo(0, 0); },
  toggleMedis: () => { S.ui.medisOpen = !S.ui.medisOpen; save(); render(); },
  toggleMeal: el => { const k = el.dataset.k; openMeals.has(k) ? openMeals.delete(k) : openMeals.add(k); render(); },
  add: el => openSearch(el.dataset.k),
  delItem: el => {
    const d = day(cur, true), k = el.dataset.k;
    d.meals[k] = d.meals[k].filter(i => i.id !== el.dataset.id);
    save(); render();
  },
  pick: el => openAmount(findFood(el.dataset.id), sheet ? sheet.meal : autoMeal()),
  back: () => openSearch(sheet.meal),
  scan: () => openScan(sheet && sheet.meal ? sheet.meal : autoMeal()),
  lookup: () => lookup($('#code').value),
  setMeal: el => {
    sheet.meal = el.dataset.k;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.k === sheet.meal));
  },
  confirmAdd: () => {
    const g = amountGrams();
    if (!(g > 0)) { $('#aerr').classList.remove('hidden'); return; }
    const { food, meal, units } = sheet, ui = +$('#au').value;
    S.lastAmt = S.lastAmt || {};
    S.lastAmt[food.id] = { q: num($('#aq').value), ui };
    S.recent =[food.id].concat(S.recent.filter(id => id !== food.id)).slice(0, 12);
    if (addTarget === 'recipe' && recipeView && recipeView.mode === 'edit') {
      recipeView.draft.items.push({ id: uid(), fid: food.id, name: food.name, g: Math.round(g * 10) / 10, n: { ...food.n }, ml: food.ml });
      save(); closeSheet(); render(); toast('Zutat hinzugefügt');
      return;
    }
    const d = day(cur, true);
    d.meals[meal].push({ id: uid(), fid: food.id, name: food.name, g: Math.round(g * 10) / 10, n: { ...food.n }, ml: food.ml,
      u: ui ? `${fmt(num($('#aq').value), 2)} × ${units[ui][0]}` : '' });
    save(); closeSheet();
    openMeals.add(meal);
    if (tab === 'heute') render();
    toast(`Zu ${mealName(meal)} hinzugefügt`);
  },
  closeSheet,
  newFood: () => openNewFood(),
  saveFood: () => {
    const v = id => num($('#' + id).value);
    const name = $('#nf-name').value.trim(), err = $('#nferr');
    const show = m => { err.textContent = m; err.classList.remove('hidden'); };
    if (!name) return show('Gib einen Namen ein.');
    if (!(v('nf-kcal') >= 0)) return show('Gib die Kalorien pro 100 g ein.');
    const pg = v('nf-pg'), pn = $('#nf-pn').value.trim();
    const food = { id: 'c' + uid(), name, custom: true, ml: $('#nf-ml').checked,
      n: { kcal: v('nf-kcal'), p: v('nf-p') || 0, c: v('nf-c') || 0, f: v('nf-f') || 0, fib: v('nf-fib') || 0, fe: 0, ca: 0, zn: 0 },
      u: pn && pg > 0 ? [[pn, pg]] : [] };
    if (sheet.code) food.code = sheet.code;
    S.custom.push(food); save();
    const meal = sheet.meal; sheet = null;
    openAmount(food, meal);
  },
  addMedi: () => {
    const name = $('#mn').value.trim(), nut = $('#mnut').value, amt = num($('#mamt').value);
    const err = m => { $('#merr').textContent = m; $('#merr').classList.remove('hidden'); };
    if (!name) return err('Gib einen Namen ein.');
    if (nut && !(amt > 0)) return err('Gib die Menge pro Einnahme ein, oder wähl „Zählt als Nährstoff: nein“.');
    const data = { name, time: $('#mt').value, nut: nut || undefined, amt: nut ? amt : undefined };
    const ex = S.medis.find(x => x.id === editMedi);
    if (ex) Object.assign(ex, data); else S.medis.push({ id: uid(), ...data });
    editMedi = null; save(); render(); toast(ex ? 'Gespeichert' : 'Hinzugefügt');
  },
  editMedi: el => { editMedi = el.dataset.id; render(); $('#mn').scrollIntoView({ block: 'center' }); },
  cancelMedi: () => { editMedi = null; render(); },
  delMedi: el => {
    const m = S.medis.find(x => x.id === el.dataset.id);
    if (m && confirm(`„${m.name}“ aus der Liste löschen?`)) { S.medis = S.medis.filter(x => x !== m); save(); render(); }
  },
  exportData: async () => {
    const name = `lavendel-backup-${today()}.json`;
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, e);
});

/* Rezept-Editor: Eingaben direkt in den Entwurf übernehmen */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.draft && recipeView && recipeView.mode === 'edit') {
    recipeView.draft[el.dataset.draft] = el.dataset.draft === 'servings' ? num(el.value) : el.value;
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (recipeView && recipeView.mode === 'edit' && (el.dataset.draft === 'servings' || el.dataset.ri)) {
    if (el.dataset.ri) {
      const v = num(el.value), it = recipeView.draft.items[+el.dataset.ri];
      if (v > 0) { if (it.u && it.g > 0) it.u[0] = Math.round(it.u[0] * v / it.g * 100) / 100; it.g = v; }
    }
    render(); return;
  }
  if (el.dataset.bind) {
    const [o, k] = el.dataset.bind.split('.');
    let v = el.value;
    // Auswahllisten direkt als Zahl lesen: num() würde „1.725“ als Tausenderzahl 1725 verstehen
    if (k !== 'sex') v = el.tagName === 'SELECT' ? parseFloat(v) : num(v);
    if (el.tagName === 'INPUT' && !(v > 0)) { toast('Bitte eine Zahl größer als 0'); render(); return; }
    if (o === 'goals') S.goals = { ...goals(), [k]: v };
    else if (o === 'profile') { S.profile[k] = v; S.setup = true; }
    else S[k] = v;
    save(); render();
  } else if (el.id === 'ownGoals') {
    S.goals = el.checked ? { ...suggest(S.profile) } : null; S.setup = true; save(); render();
  } else if (el.id === 'mn') {
    $('#merr').classList.add('hidden');
  } else if (el.id === 'imp' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || !data.days || !data.profile) throw new Error();
        if (!confirm('Backup laden? Deine aktuellen Daten werden dabei ersetzt.')) return;
        localStorage.setItem(KEY, JSON.stringify(data)); S = load(); render(); toast('Backup geladen');
      } catch (err) { alert('Diese Datei ist kein gültiges Lavendel-Backup.'); }
    };
    r.readAsText(el.files[0]);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'aq') ACT.confirmAdd();
  if (e.key === 'Enter' && e.target.id === 'shopin') shopAddManual();
  if (e.key === 'Enter' && e.target.id === 'code') ACT.lookup();
  if (e.key === 'Escape' && sheet) closeSheet();
});

/* Beim Zurückkehren in die App auf den aktuellen Tag springen */
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) { if (cur === lastDay) cur = today(); lastDay = today(); render(); }
});

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  // Neue Version übernommen: einmal neu laden, damit sie sofort sichtbar ist
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || sheet) return;
    reloading = true; location.reload();
  });
  // iOS öffnet die App oft aus dem Hintergrund, dann aktiv nach Updates schauen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  });
}

seedRecipes();
render();
