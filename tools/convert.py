"""Schweizer Nährwertdatenbank -> foods-db.js (nur vegane Lebensmittel)."""
import json
import re
import sys
sys.path.insert(0, sys.argv[2])
sys.stdout.reconfigure(encoding='utf-8')
from xlsx import read_rows

SRC, OUT = sys.argv[1], sys.argv[3]
MODE = sys.argv[4] if len(sys.argv) > 4 else 'write'

rows = read_rows(SRC, 1)
head = rows[1]
data = rows[2:]

def col(label):
    for i, h in enumerate(head):
        if h.strip().startswith(label):
            return i
    raise KeyError(label)

KEYS = [  # App-Schlüssel, Spaltenanfang
    ('kcal', 'Energie, Kilokalorien'), ('p', 'Protein'), ('c', 'Kohlenhydrate, verfügbar'),
    ('f', 'Fett, total'), ('fib', 'Nahrungsfasern'), ('fe', 'Eisen'), ('ca', 'Calcium'),
    ('zn', 'Zink'), ('b12', 'Vitamin B12'), ('d', 'Vitamin D'), ('jod', 'Jod'), ('se', 'Selen'),
    ('mg', 'Magnesium'), ('fol', 'Folat'), ('ala', 'Alpha-Linolensäure'), ('b2', 'Vitamin B2'),
]
COLS = [col(lbl) for _, lbl in KEYS]
C_ID, C_NAME, C_SYN, C_CAT = col('ID'), col('Name'), col('Synonyme'), col('Kategorie')

EXCL_CAT = (
    'Eier', 'Fisch', 'Fleisch und Innereien', 'Fleisch- und Wurstwaren', 'Milch und Milchprodukte',
    'Fette und Öle/Rahm', 'Fette und Öle/Mayonnaisen', 'Gerichte', 'Süssigkeiten/Kuchen',
    'Süssigkeiten/Guetzli', 'Süssigkeiten/Sonstige süsse Backwaren', 'Süssigkeiten/Cremen',
    'Süssigkeiten/Glacen auf Milchbasis', 'Alkoholhaltige Getränke', 'Speziallebensmittel',
)
PLANT_OK = re.compile(r'(soja|hafer|mandel|reis|kokos|erbsen|dinkel|cashew|pflanz|vegan)', re.I)
ANIMAL = re.compile(
    r'(butter(?!milchsäure)|käse|kaese|\bei\b|eier|eigelb|eiweiss|honig|fleisch|speck|schinken|wurst|'
    r'poulet|huhn|lachs|thon|thunfisch|sardell|gelatine|quark|mozzarella|parmesan|mascarpone|'
    r'rahm|sahne|joghurt|jogurt|milch|molke|schmalz|talg|anchov|krevette|garnele|kalb|rind|schwein|'
    r'lamm|ente|truthahn|trute|hirsch|reh|meringue|mayonnaise|vollmilch|rahmglace|zabaione|nougat|'
    r'milchschokolade|weisse schokolade|ricotta|feta|hüttenkäse|creme fraiche|crème fraîche|zieger)', re.I)

# Vegan, obwohl ein "tierisches" Wort im Namen steckt
RESCUE = re.compile(r'(eierschwamm|erdnussbutter|kakaobutter|ohne butter|ohne ei\b|honigmelone)', re.I)
# Nicht vegan, obwohl man es am Namen/der Kategorie nicht direkt sieht
EXTRA_DROP = re.compile(
    r'(béchamel|bolognaise|bratensauce|dulce de leche|hollandaise|jägersauce|pestosauce|pilzsauce|'
    r'quarkblätterteig|tzatziki|mit honig|worcester|gipfeli|spätzli|zwieback|weichkaramell|'
    r'malzgetränk|hefeteig|mürbeteig|schokolade, weiss|getreide-kissen|gepufftes oder extrudiertes)', re.I)


def is_animal_chocolate(name):
    n = name.lower()
    return 'schokolade' in n and not any(w in n for w in ('dunkel', 'pulver', 'soja', 'kakaogetränk'))


# Schweizer -> deutsche Begriffe im angezeigten Namen (Original bleibt suchbar)
RENAME = [
    (r'\bPeperoni\b', 'Paprika'), (r'Zucchetti', 'Zucchini'), (r'Federkohl', 'Grünkohl'), (r'Baumnuss', 'Walnuss'),
    (r'Teigwaren', 'Nudeln'), (r'Rüebli', 'Möhre'), (r'Nüsslisalat', 'Feldsalat'), (r'\bRanden\b', 'Rote Bete'),
    (r'Eierschwamm', 'Pfifferling'), (r'Zwetschge', 'Pflaume'), (r'\bKefe\b', 'Zuckerschote'), (r'Weggli', 'Brötchen'),
    (r'Marroni', 'Maronen'), (r'Kartoffelstock', 'Kartoffelpüree'), (r'Pommes Chips', 'Kartoffelchips'),
    (r'Peperoncini', 'Chili'), (r'Konfitüre', 'Marmelade'), (r'\bGlace', 'Eis'), (r'Süssmost', 'Apfelsaft'),
]
# Zusätzliche Suchbegriffe
EXTRA_SEARCH = [
    (r'sojagetränk', 'sojamilch sojadrink'), (r'hafergetränk', 'hafermilch haferdrink'),
    (r'mandelgetränk', 'mandelmilch mandeldrink'), (r'reisgetränk', 'reismilch reisdrink'),
    (r'kokosnussgetränk', 'kokosmilch kokosdrink'), (r'joghurtalternative', 'joghurt sojajoghurt'),
    (r'käsealternative', 'veganer käse'), (r'karotte', 'möhre mohrrübe'), (r'bürli|semmeli|brötli|mütschli', 'brötchen'),
    (r'teigwaren', 'pasta spaghetti'), (r'texturiert', 'sojaschnetzel sojagranulat'), (r'erdnussbutter', 'erdnussmus'),
    (r'sesamsamen', 'sesam tahin'), (r'linse', 'linsen'), (r'kichererbse', 'kichererbsen'), (r'bohne', 'bohnen kidney'),
    (r'gehacktes, vegan', 'hack hackfleisch'), (r'kartoffel, ', 'kartoffeln'),
]


def num(v):
    v = str(v).strip()
    if v in ('', 'k.A.', '-'):
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return round(x, 3 if abs(x) < 1 else 2 if abs(x) < 10 else 1)

kept, dropped = [], []
for r in data:
    r = r + [''] * (len(head) - len(r))
    name, cat, syn = r[C_NAME].strip(), r[C_CAT].strip(), r[C_SYN].strip()
    if not name:
        continue
    cats = [c.strip() for c in cat.split(';')]
    reason = None
    if any(c.startswith(EXCL_CAT) for c in cats):
        reason = 'Kategorie'
    elif RESCUE.search(name):
        reason = None
    elif EXTRA_DROP.search(name) or is_animal_chocolate(name):
        reason = 'Liste'
    elif ANIMAL.search(name) and not PLANT_OK.search(name):
        reason = 'Name'
    vals = [num(r[c]) for c in COLS]
    if vals[0] is None:
        reason = reason or 'ohne kcal'
    if reason:
        dropped.append((reason, name, cat))
        continue
    short = cats[0].split('/')[-1]
    shown = name
    for pat, rep in RENAME:
        shown = re.sub(pat, rep, shown)
    search = [syn, name if shown != name else '', short]
    for pat, extra in EXTRA_SEARCH:
        if re.search(pat, name, re.I):
            search.append(extra)
    search = ' '.join(s for s in search if s).lower()
    kept.append(['s' + r[C_ID].strip(), shown, short, search] + vals)

print(f'Behalten: {len(kept)}, entfernt: {len(dropped)}')
if MODE == 'review':
    for k in kept:
        print('KEEP |', k[2], '|', k[1])
    for d in dropped:
        if d[0] == 'Name':
            print('DROP-NAME |', d[2], '|', d[1])
    sys.exit()

with open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write('// Quelle: Schweizer Nährwertdatenbank V 7.0, Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV, naehrwertdaten.ch\n')
    fh.write('// Nur vegane Lebensmittel, automatisch erzeugt. Werte pro 100 g essbarer Anteil, null = keine Angabe.\n')
    fh.write('const DB_KEYS = ' + json.dumps([k for k, _ in KEYS]) + ';\n')
    fh.write('const DB_FOODS = [\n')
    for k in kept:
        fh.write(json.dumps(k, ensure_ascii=False, separators=(',', ':')) + ',\n')
    fh.write('];\n')
print('geschrieben:', OUT)
