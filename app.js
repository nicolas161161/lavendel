'use strict';

/* ---------- Grundlagen ---------- */
const KEY = 'lavendel-v1';
const VERSION = 5;
const MEALS = [
  { k: 'fr', n: 'Frühstück', i: 'ti-coffee' },
  { k: 'mi', n: 'Mittagessen', i: 'ti-salad' },
  { k: 'ab', n: 'Abendessen', i: 'ti-soup' },
  { k: 'sn', n: 'Snacks', i: 'ti-cookie' },
];
const TIMES = ['morgens', 'mittags', 'abends', 'zur Nacht', 'bei Bedarf'];
const BASE = RAW_FOODS.map(r => ({
  id: r[0], name: r[1],
  n: { kcal: r[2], p: r[3], c: r[4], f: r[5], fib: r[6], fe: r[7], ca: r[8], zn: r[9] },
  u: r[10] || [], ml: !!r[11],
}));

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: d });
const num = v => parseFloat(String(v).replace(',', '.'));
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = s => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');

function defState() {
  return {
    profile: { sex: 'w', age: 30, height: 170, weight: 65, act: 1.55, goal: 0 },
    goals: null, waterGoal: 3, bottle: 0.75, setup: false,
    medis: [{ id: 'm1', name: 'Vitamin B12', time: 'morgens' }, { id: 'm2', name: 'Vitamin D3', time: 'morgens' }],
    custom: [], recipes: [], recent: [], days: {}, ui: { medisOpen: true },
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      const d = defState();
      return { ...d, ...s, profile: { ...d.profile, ...s.profile }, ui: { ...d.ui, ...s.ui } };
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
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, fe: 0, ca: 0, zn: 0 }; let g = 0;
  for (const it of items) { g += it.g; for (const k in t) t[k] += (it.n[k] || 0) * it.g / 100; }
  return { t, g };
}
function recipeFood(r) {
  const { t, g } = recipeTotals(r.items), n = {};
  for (const k in t) n[k] = g ? Math.round(t[k] / g * 100 * 100) / 100 : 0;
  return { id: 'r' + r.id, name: r.name, recipe: true, n, ml: false, u: [['Portion', Math.round(g / r.servings) || 1]] };
}
const allFoods = () => BASE.concat(S.custom, S.recipes.map(recipeFood));
const findFood = id => allFoods().find(f => f.id === id);

function suggest(p) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const kcal = Math.round((bmr * p.act + Number(p.goal)) / 10) * 10;
  const pr = Math.round(p.weight * 1.2);
  const f = Math.round(kcal * 0.3 / 9);
  const c = Math.max(0, Math.round((kcal - pr * 4 - f * 9) / 4));
  return { kcal, p: pr, c, f };
}
const goals = () => S.goals || suggest(S.profile);

function totals(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, fe: 0, ca: 0, zn: 0 };
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
    ? S.medis.map(m => { const v = d.medis[m.id], tm = medTime(v);
        return `<button class="med${v ? ' done' : ''}" data-act="med" data-id="${m.id}"><span class="ck${v ? ' on' : ''}"><i class="ti ti-check"></i></span><span class="grow"><span class="mn">${esc(m.name)}</span>${tm ? `<small class="mt">genommen um ${tm} Uhr</small>` : ''}</span><small>${esc(m.time)}</small></button>`; }).join('')
    : `<p class="note">Noch keine Medis. Du kannst sie im Profil anlegen.</p>`;

  const meals = MEALS.map(m => {
    const items = d.meals[m.k] || [], isOpen = openMeals.has(m.k) && items.length;
    return `<div class="meal"><div class="mrow">
      <button data-act="toggleMeal" data-k="${m.k}"><span class="ic"><i class="ti ${m.i}"></i></span>
        <span class="grow">${m.n}${items.length ? `<small> · ${items.length}</small>` : ''}</span>
        ${items.length ? `<span class="kc">${fmt(mealKcal(d, m.k))}</span><i class="ti ti-chevron-${isOpen ? 'up' : 'down'} chev"></i>` : ''}
      </button>
      <button class="plus" data-act="add" data-k="${m.k}" aria-label="Zu ${m.n} hinzufügen"><i class="ti ti-plus"></i></button>
    </div>${isOpen ? `<div class="items">${items.map(it => `<div class="item"><span class="grow">${esc(it.name)}<small>${fmt(it.g)} ${it.ml ? 'ml' : 'g'}${it.u ? ' · ' + esc(it.u) : ''}</small></span><span class="kc">${fmt(it.n.kcal * it.g / 100)}</span><button class="del" data-act="delItem" data-k="${m.k}" data-id="${it.id}" aria-label="${esc(it.name)} entfernen"><i class="ti ti-x"></i></button></div>`).join('')}</div>` : ''}</div>`;
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

function vRezepte() {
  if (recipeView && recipeView.mode === 'edit') return vRezeptEdit();
  if (recipeView && recipeView.mode === 'view') {
    const r = S.recipes.find(x => x.id === recipeView.id);
    if (r) return vRezeptView(r);
    recipeView = null;
  }
  const list = S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map(r => {
    const { t } = recipeTotals(r.items);
    return `<button class="rcard" data-act="openRecipe" data-id="${r.id}"><span class="ic"><i class="ti ti-chef-hat"></i></span>
      <span class="grow"><b>${esc(r.name)}</b><small>${fmt(r.servings, 1)} Portionen · ${fmt(t.kcal / r.servings)} kcal pro Portion</small></span><i class="ti ti-chevron-right chev"></i></button>`;
  }).join('');
  return `<h1>Rezepte</h1>
  ${list ? `<div class="card" style="padding:2px 14px">${list}</div>`
    : `<div class="card banner"><i class="ti ti-chef-hat"></i><span class="grow"><b>Leg dein erstes Rezept an</b><br><small>Zutaten einmal eintragen, danach mit einem Tipp als Portion ins Tagebuch.</small></span></div>`}
  <button class="primary" data-act="newRecipe"><i class="ti ti-plus"></i> Neues Rezept</button>`;
}

function nutGrid(t, div) {
  const v = (k, d) => fmt(t[k] / div, d);
  return `<div class="prev"><div><b>${v('kcal', 0)}</b><small>kcal</small></div><div><b>${v('p', 1)}</b><small>Protein</small></div><div><b>${v('c', 1)}</b><small>KH</small></div><div><b>${v('f', 1)}</b><small>Fett</small></div></div>`;
}

function vRezeptView(r) {
  const sc = recipeView.scale || r.servings, f = sc / r.servings, { t } = recipeTotals(r.items);
  return `<div class="top">
      <button class="iconbtn" data-act="recipeBack" aria-label="Zurück zur Liste"><i class="ti ti-chevron-left"></i></button>
      <h1 class="grow" style="margin:4px 0">${esc(r.name)}</h1>
      <button class="iconbtn" data-act="editRecipe" aria-label="Rezept bearbeiten"><i class="ti ti-edit"></i></button></div>
    <div class="card"><h3>Pro Portion</h3>${nutGrid(t, r.servings)}</div>
    <div class="card">
      <div class="chead"><span>Zutaten</span>
        <span class="stepper"><button class="iconbtn" data-act="scale" data-n="-1" aria-label="Weniger Portionen"><i class="ti ti-minus"></i></button>
        <span><b>${fmt(sc, 1)}</b> Port.</span>
        <button class="iconbtn" data-act="scale" data-n="1" aria-label="Mehr Portionen"><i class="ti ti-plus"></i></button></span></div>
      ${sc !== r.servings ? `<small>Umgerechnet von ${fmt(r.servings, 1)} Portionen</small>` : ''}
      ${r.items.map(it => `<div class="ditem ing"><span>${esc(it.name)}</span><span>${fmt(it.g * f, it.g * f < 10 ? 1 : 0)} ${it.ml ? 'ml' : 'g'}</span></div>`).join('')}
    </div>
    ${r.notes ? `<div class="card"><h3>Zubereitung</h3><p class="notes">${esc(r.notes)}</p></div>` : ''}
    <button class="primary" data-act="logRecipe" data-id="${r.id}"><i class="ti ti-plus"></i> Ins Tagebuch eintragen</button>`;
}

function vRezeptEdit() {
  const d = recipeView.draft, { t } = recipeTotals(d.items);
  const rows = d.items.map((it, i) => `<div class="ingrow"><span class="grow">${esc(it.name)}<small>${fmt(it.n.kcal * it.g / 100)} kcal</small></span>
      <input class="gin" data-ri="${i}" inputmode="decimal" value="${fmt(it.g, 1)}" aria-label="Menge ${esc(it.name)}"><span class="unit">${it.ml ? 'ml' : 'g'}</span>
      <button class="del" data-act="delIng" data-ri="${i}" aria-label="${esc(it.name)} entfernen"><i class="ti ti-x"></i></button></div>`).join('');
  return `<div class="top">
      <button class="iconbtn" data-act="cancelEdit" aria-label="Abbrechen"><i class="ti ti-chevron-left"></i></button>
      <h1 class="grow" style="margin:4px 0">${d.id ? 'Rezept bearbeiten' : 'Neues Rezept'}</h1></div>
    <div class="card">
      <label class="field">Name<input data-draft="name" value="${esc(d.name)}" placeholder="Linsencurry" autocomplete="off"></label>
      <label class="field">Das Rezept ergibt (Portionen)<input data-draft="servings" inputmode="decimal" value="${fmt(d.servings, 1)}"></label>
    </div>
    <div class="card"><div class="chead"><span>Zutaten</span><span class="val">${fmt(t.kcal)} kcal gesamt</span></div>
      ${rows || '<p class="note">Noch keine Zutaten.</p>'}
      <button class="secondary" data-act="addIng" style="margin-top:8px"><i class="ti ti-plus"></i> Zutat hinzufügen</button>
    </div>
    ${d.items.length ? `<div class="card"><h3>Pro Portion</h3>${nutGrid(t, d.servings || 1)}</div>` : ''}
    <div class="card"><label class="field" style="margin:0">Zubereitung (optional)<textarea data-draft="notes" rows="4" placeholder="Zwiebeln anbraten, Linsen und Kokosmilch dazu …">${esc(d.notes || '')}</textarea></label></div>
    <p id="rerr" class="err hidden"></p>
    <button class="primary" data-act="saveRecipe">Rezept speichern</button>
    ${d.id ? `<button class="secondary" data-act="delRecipe" style="margin-top:10px"><i class="ti ti-trash"></i> Rezept löschen</button>` : ''}`;
}

function vAuswertung() {
  const d = day(cur), t = totals(d), g = goals(), m = S.profile.sex === 'm';
  const ekcal = t.p * 4 + t.c * 4 + t.f * 9 || 1;
  const row = (lbl, v, goal, unit, col) => `<div class="nrow"><div class="lbl"><span>${lbl}</span><span>${fmt(v, v >= 100 ? 0 : 1)} / ${fmt(goal)} ${unit}</span></div><div class="bar"><i style="width:${Math.min(v / goal * 100, 100)}%;background:${col}"></i></div></div>`;
  return `<h1>Auswertung</h1>
  ${vWoche()}
  <h2 style="margin:22px 0 0">${dateLabel(cur)} im Detail</h2>
  <div class="card"><h3>Energie und Makros</h3>
    ${row('Kalorien', t.kcal, g.kcal, 'kcal', '#AFA9EC')}
    ${row('Protein', t.p, g.p, 'g', '#7F77DD')}${row('Kohlenhydrate', t.c, g.c, 'g', '#ED93B1')}${row('Fett', t.f, g.f, 'g', '#5DCAA5')}
    <p class="note">Energieverteilung: ${fmt(t.p * 4 / ekcal * 100)} % Protein · ${fmt(t.c * 4 / ekcal * 100)} % Kohlenhydrate · ${fmt(t.f * 9 / ekcal * 100)} % Fett</p>
  </div>
  <div class="card"><h3>Nährstoffe</h3>
    ${row('Ballaststoffe', t.fib, 30, 'g', '#5DCAA5')}
    ${row('Eisen', t.fe, m ? 11 : 15, 'mg', '#7F77DD')}
    ${row('Calcium', t.ca, 1000, 'mg', '#7F77DD')}
    ${row('Zink', t.zn, m ? 16 : 10, 'mg', '#7F77DD')}
    <p class="note">Richtwerte orientiert an der DGE, beim Zink schon an pflanzliche Ernährung angepasst. B12, Jod, Vitamin D und Omega-3 kommen mit der großen Datenbank dazu. Bei eigenen und gescannten Produkten fehlen Mineralstoffe oft, weil sie nicht auf der Packung stehen.</p>
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
      const medis = S.medis.filter(m => x.d.medis[m.id]).map(m => esc(m.name) + (medTime(x.d.medis[m.id]) ? ` (${medTime(x.d.medis[m.id])})` : '')).join(', ');
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
  const inp = (bind, lbl, val, unit) => `<label class="field">${lbl}${unit ? ` (${unit})` : ''}<input data-bind="${bind}" inputmode="decimal" value="${fmt(val, 2)}"></label>`;
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
    ${own ? `<div class="grid2">${inp('goals.kcal', 'Kalorien', g.kcal, 'kcal')}${inp('goals.p', 'Protein', g.p, 'g')}${inp('goals.c', 'Kohlenhydrate', g.c, 'g')}${inp('goals.f', 'Fett', g.f, 'g')}</div>`
          : `<p class="note" style="margin:0">Es gilt der Vorschlag von oben. Er passt sich an, wenn du deine Daten änderst.</p>`}
  </div>

  <div class="card"><h3>Wasser</h3>
    <div class="grid2">${inp('S.waterGoal', 'Tagesziel', S.waterGoal, 'l')}${inp('S.bottle', 'Flaschengröße', S.bottle, 'l')}</div>
  </div>

  <div class="card"><h3>Medis</h3>
    <div class="mlist">${S.medis.map(m => `<div class="med"><span class="grow">${esc(m.name)}</span><small>${esc(m.time)}</small><button class="del" data-act="delMedi" data-id="${m.id}" aria-label="${esc(m.name)} löschen"><i class="ti ti-trash"></i></button></div>`).join('') || '<p class="note" style="margin:0">Noch keine Einträge.</p>'}</div>
    <div class="addmedi"><input id="mn" placeholder="Omega-3 (Algenöl)" autocomplete="off"><select id="mt">${TIMES.map(t => `<option>${t}</option>`).join('')}</select></div>
    <p id="merr" class="err hidden">Gib einen Namen ein.</p>
    <button class="secondary" data-act="addMedi"><i class="ti ti-plus"></i> Hinzufügen</button>
  </div>

  <div class="card"><h3>Deine Daten</h3>
    <p class="note" style="margin:0 0 6px">Alles wird nur auf diesem Gerät gespeichert. Mach ab und zu ein Backup.</p>
    <button class="secondary" data-act="exportData"><i class="ti ti-download"></i> Backup sichern</button>
    <label class="secondary"><i class="ti ti-upload"></i> Backup laden<input id="imp" type="file" accept="application/json,.json" class="hidden"></label>
  </div>
  <p class="note" style="text-align:center">Lavendel · Version ${VERSION}</p>`;
}

/* ---------- Suche & Bottom-Sheet ---------- */
function results(q) {
  const foods = allFoods().filter(f => addTarget !== 'recipe' || !f.recipe), words = norm(q).split(/\s+/).filter(Boolean);
  let list;
  if (!words.length) {
    const rec = S.recent.map(findFood).filter(Boolean);
    list = rec.concat(foods.filter(f => !S.recent.includes(f.id)).sort((a, b) => a.name.localeCompare(b.name, 'de')));
  } else {
    list = foods.filter(f => words.every(w => norm(f.name).includes(w)))
      .sort((a, b) => norm(a.name).indexOf(words[0]) - norm(b.name).indexOf(words[0]) || a.name.localeCompare(b.name, 'de'));
  }
  const rows = list.map(f => `<button class="res" data-act="pick" data-id="${f.id}"><span class="grow">${esc(f.name)}${f.recipe ? '<span class="tag">Rezept</span>' : f.src === 'off' ? '<span class="tag">Produkt</span>' : f.custom ? '<span class="tag">eigenes</span>' : ''}${!words.length && S.recent.includes(f.id) ? '<i class="ti ti-history rec"></i>' : ''}</span><small>${fmt(f.n.kcal)} kcal / 100 ${f.ml ? 'ml' : 'g'}</small></button>`).join('');
  return (rows || '<p class="empty">Nichts gefunden.</p>') +
    `<button class="res new" data-act="newFood"><i class="ti ti-plus"></i><span class="grow">Eigenes Lebensmittel anlegen</span></button>`;
}
function bindSearch(inp, res) {
  const run = () => { res.innerHTML = results(inp.value); };
  inp.addEventListener('input', run);
  run();
}

function showSheet(html) {
  stopScanner();
  const s = $('#sheet');
  s.innerHTML = `<div class="backdrop" data-act="closeSheet"></div><div class="panel" role="dialog"><div class="grab"></div>${html}</div>`;
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
    s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
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
      fib: +n.fiber_100g || 0, fe: mg(n.iron_100g), ca: mg(n.calcium_100g), zn: mg(n.zinc_100g) } };
}
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
    <div class="search"><i class="ti ti-search"></i><input id="sq" type="search" placeholder="Lebensmittel suchen" autocomplete="off">${scanBtn}</div>
    <div id="sres"></div>`);
  bindSearch($('#sq'), $('#sres'));
}

function openAmount(food, meal) {
  if (!food) return;
  const base = food.ml ? 'ml' : 'g';
  const units = [[base, 1]].concat(food.u);
  sheet = { mode: 'amount', food, meal, units, from: !!sheet && (sheet.mode === 'search' || sheet.mode === 'scan') };
  const ui = food.u.length ? 1 : 0;
  showSheet(`<div class="shead">
      ${sheet.from ? `<button class="iconbtn" data-act="back" aria-label="Zurück"><i class="ti ti-chevron-left"></i></button>` : ''}
      <h2 class="grow">${esc(food.name)}</h2>${closeBtn}</div>
    <div class="amt"><input id="aq" inputmode="decimal" value="${ui ? 1 : 100}" aria-label="Menge">
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
  tab: el => { tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
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
    S.recent = [food.id].concat(S.recent.filter(id => id !== food.id)).slice(0, 12);
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
    const name = $('#mn').value.trim();
    if (!name) { $('#merr').classList.remove('hidden'); return; }
    S.medis.push({ id: uid(), name, time: $('#mt').value }); save(); render();
  },
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
    if (el.dataset.ri) { const v = num(el.value); if (v > 0) recipeView.draft.items[+el.dataset.ri].g = v; }
    render(); return;
  }
  if (el.dataset.bind) {
    const [o, k] = el.dataset.bind.split('.');
    let v = el.value;
    if (k !== 'sex') v = num(v);
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

render();
