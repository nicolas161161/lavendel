// Standardrezepte, werden beim ersten Öffnen einmalig zu „Rezepte“ hinzugefügt.
// Zutat: [Name, Gramm, Nährwerte, Optionen]
//   Nährwerte: 's123' = Schweizer Nährwertdatenbank, 'b:id' = Startliste, Objekt = Packungsangabe (Open Food Facts) pro 100 g
//   Optionen: v = Vorrat (kommt nicht auf die Einkaufsliste), u = [Anzahl, Einheit], ml = Flüssigkeit, t = Text statt Menge
const SEED_RECIPES = (() => {
const P = { // Markenprodukte und Zutaten, die nicht in der Datenbank sind (pro 100 g bzw. 100 ml)
  beyond: { kcal: 238, p: 15, c: 4.8, f: 17 },                       // Beyond Meat Beyond Hack
  reibe: { kcal: 280, p: 3.3, c: 19.6, f: 20.8, fib: 0.8 },          // Aldi My Vay veganer Reibegenuss
  hackAldi: { kcal: 237, p: 19, c: 7, f: 14 },                       // Aldi veganes Bio Hack
  creme: { kcal: 287, p: 2.3, c: 1.7, f: 30 },                       // vegane Creme (Creme Vega)
  seiden: { kcal: 48, p: 5.3, c: 1.8, f: 2.1 },                      // Taifun Seidentofu
  kochsahne: { kcal: 170, p: 3.3, c: 4.7, f: 15.3 },                 // vegane Kochsahne (Durchschnitt)
  teig: { kcal: 270, p: 7.5, c: 45, f: 5, fib: 2.4 },                // Flammkuchenteig (Kühlregal)
  frisch: { kcal: 296, p: 1.8, c: 4.7, f: 29.8, fib: 1 },            // veganer Frischkäse
  feta: { kcal: 260, p: 5.5, c: 9, f: 22.5, fib: 2 },                // veganer Feta-Block (Durchschnitt)
  udon: { kcal: 145, p: 3.2, c: 29, f: 1.3 },                        // Udon-Nudeln, vorgekocht
  gochu: { kcal: 230, p: 6, c: 42, f: 1.5, fib: 1 },                 // Gochujang
  oyster: { kcal: 113, p: 1.2, c: 27, f: 0.5 },                      // vegane Austernsauce
  soja: { kcal: 86, p: 6.2, c: 14.9, f: 0 },                         // Sojasauce dunkel
  senf: { kcal: 99, p: 6, c: 1.2, f: 6.2, fib: 4.5 },                // Senf mittelscharf
  tomDose: { kcal: 23, p: 1.2, c: 3.3, f: 0.4, fib: 1 },             // gehackte Tomaten (Dose)
  tomTrock: { kcal: 200, p: 4, c: 15, f: 12, fib: 5 },               // getrocknete Tomaten in Öl
  bruehe: { kcal: 4, p: 0, c: 0.7, f: 0 },                           // Gemüsebrühe, zubereitet
  braten: { kcal: 370, p: 7, c: 62, f: 9, fib: 2 },                  // Bratensaucenpulver (Schätzung)
  speck: { kcal: 250, p: 18, c: 6, f: 17, fib: 2 },                  // veganer Speck, Würfel (Schätzung)
  cumin: { kcal: 375, p: 18, c: 44, f: 22, fib: 11 },                // Kreuzkümmel
};
const SALT = ['Salz, Pfeffer', 0, null, { v: 1, t: 'nach Geschmack' }];

return [
  { sid: 'risotto', icon: '🍄', name: 'Pilz-Lauch-Risotto', servings: 2, meta: 'ca. 35 Min · Meal Prep · hält 2–3 Tage im Kühlschrank',
    items: [
      ['Risottoreis (Milchreis)', 250, 's427'],
      ['Lauch', 200, 's358', { u: [1, 'Stange'] }],
      ['Champignons', 250, 's375'],
      ['Räuchertofu (REWE Bio)', 175, 's14090', { u: [1, 'Block'] }],
      ['Hefeflocken', 15, 'b:hefeflocken', { v: 1, u: [3, 'EL'] }],
      ['Knoblauch', 6, 's356', { v: 1, u: [2, 'Zehen'] }],
      ['Gemüsebrühe (heiß)', 800, P.bruehe, { v: 1, ml: 1 }],
      ['Olivenöl', 20, 's591', { v: 1, u: [2, 'EL'] }],
      SALT],
    steps: ['Tofu in kleine Würfel schneiden und in 1 EL Öl ca. 6 Min knusprig braten. Rausnehmen.',
      'Lauch in Ringe, Pilze in Scheiben schneiden, Knoblauch hacken.',
      'Restliches Öl in einen Topf, Lauch und Knoblauch 3 Min andünsten. Pilze dazu und 3 Min mitbraten.',
      'Reis dazugeben und 1 Min unter Rühren anschwitzen. Mit einer Kelle Brühe (oder Weißwein) ablöschen.',
      'Nach und nach Brühe dazugeben, immer wenn sie fast aufgesogen ist. Öfter umrühren. Dauert ca. 20 Min, bis der Reis cremig und gar ist.',
      'Hefeflocken unterrühren, mit Salz und Pfeffer abschmecken. Tofu oben drauf.'],
    tip: 'Beim Aufwärmen einen Schuss Wasser dazugeben, dann wird’s wieder cremig.' },

  { sid: 'vk-pasta', icon: '🍝', name: 'Vegane Vollkorn Pasta', servings: 2, meta: 'ca. 20 Min · Meal Prep',
    items: [
      ['Vollkorn Mezze Rigatoni (dm)', 200, 's801'],
      ['Vegane Kochsahne', 200, P.kochsahne, { ml: 1 }],
      ['Weiße Bohnen (Dose, abgetropft)', 240, 's13388', { u: [1, 'Dose'] }],
      ['Getrocknete Tomaten', 50, P.tomTrock],
      ['Zwiebel', 80, 's368', { u: [1, 'Stück'] }],
      ['Knoblauch', 6, 's356', { v: 1, u: [2, 'Zehen'] }],
      ['Hefeflocken', 10, 'b:hefeflocken', { v: 1, u: [2, 'EL'] }],
      ['Öl (gern das der Tomaten)', 10, 's591', { v: 1, u: [1, 'EL'] }],
      ['Salz, Pfeffer, Chiliflocken', 0, null, { v: 1, t: 'nach Geschmack' }]],
    steps: ['Nudeln in Salzwasser nach Packungsangabe kochen. Vor dem Abgießen eine Tasse Nudelwasser aufheben.',
      'Zwiebel und Knoblauch fein hacken, getrocknete Tomaten in Streifen schneiden.',
      'Öl in einer Pfanne erhitzen, Zwiebel 3 Min anbraten, Knoblauch und Tomaten 1 Min mitbraten.',
      'Bohnen abspülen, dazugeben, dann Sahne und Hefeflocken einrühren. 5 Min köcheln lassen.',
      'Nudeln untermischen, mit etwas Nudelwasser cremig rühren. Mit Salz, Pfeffer und Chili abschmecken.'],
    tip: 'Die Hälfte der Bohnen vorher mit der Sahne pürieren, dann wird die Sauce extra cremig und proteinreich.' },

  { sid: 'udon', icon: '🍜', name: 'Tofu Udon Noodles', servings: 2, meta: 'ca. 20 Min',
    items: [
      ['Udon-Nudeln (vorgekocht)', 400, P.udon, { u: [2, 'Packungen'] }],
      ['Brokkoli', 300, 's351', { u: [1, 'Stück'] }],
      ['Tofu natur (fest)', 200, 's13437', { u: [1, 'Block'] }],
      ['Zwiebel', 80, 's368', { u: [1, 'Stück'] }],
      ['Knoblauch', 6, 's356', { v: 1, u: [2, 'Zehen'] }],
      ['Öl', 20, 's600', { v: 1, u: [2, 'EL'] }],
      ['Dunkle Sojasauce', 30, P.soja, { v: 1, u: [2, 'EL'], ml: 1 }],
      ['Gochujang', 20, P.gochu, { v: 1, u: [1, 'EL'] }],
      ['Vegane Austernsauce', 15, P.oyster, { v: 1, u: [1, 'EL'], ml: 1 }],
      ['Geröstetes Sesamöl', 4, 's14107', { v: 1, u: [1, 'TL'] }],
      ['Zucker oder Ahornsirup', 7, 's14093', { v: 1, u: [1, 'TL'] }],
      ['Sesam (optional)', 5, 's408', { v: 1, u: [1, 'TL'] }]],
    steps: ['Alle Saucenzutaten mit 3 EL Wasser in einer Tasse verrühren.',
      'Tofu gut trocken drücken, in Würfel schneiden und in 1 EL Öl ca. 8 Min rundum knusprig braten. 2 EL der Sauce darüber, kurz schwenken, rausnehmen.',
      'Brokkoli in kleine Röschen, Zwiebel in Streifen schneiden, Knoblauch hacken.',
      'Restliches Öl in die Pfanne, Zwiebel und Brokkoli 4 Min braten. Einen Schuss Wasser dazu, Deckel drauf, 2 Min dämpfen.',
      'Udon kurz in heißem Wasser lockern, abtropfen lassen und mit Knoblauch und restlicher Sauce in die Pfanne geben. 2 Min schwenken.',
      'Tofu untermischen, mit Sesam und nach Wunsch Frühlingszwiebeln bestreuen.'] },

  { sid: 'feta-pasta', icon: '🍅', name: 'Feta-Tomaten-Pasta', servings: 2, meta: 'ca. 30 Min (25 Min Ofen) · Meal Prep',
    items: [
      ['Vollkornnudeln', 200, 's801'],
      ['Kirschtomaten', 250, 's348'],
      ['Brokkoli (klein)', 250, 's351', { u: [1, 'Stück'] }],
      ['Veganer Feta-Block', 200, P.feta, { u: [1, 'Packung'] }],
      ['Knoblauch', 6, 's356', { v: 1, u: [2, 'Zehen'] }],
      ['Olivenöl', 30, 's591', { v: 1, u: [3, 'EL'] }],
      ['Salz, Pfeffer, Oregano, Chiliflocken', 0, null, { v: 1, t: 'nach Geschmack' }]],
    steps: ['Ofen auf 200 °C Ober-/Unterhitze vorheizen.',
      'Tomaten und geschälten Knoblauch in eine Auflaufform geben, mit Öl, Salz, Pfeffer und Oregano mischen. Feta als Block in die Mitte legen.',
      '25 Min backen, bis die Tomaten aufplatzen.',
      'In der Zeit Nudeln kochen. Brokkoli in Röschen schneiden und die letzten 3 Min mitkochen.',
      'Feta, Tomaten und Knoblauch in der Form mit einer Gabel zerdrücken und verrühren. Nudeln und Brokkoli untermischen.'] },

  { sid: 'bolognese', icon: '🍝', name: 'Vegane Bolognese', servings: 4, meta: 'ca. 50 Min · Meal Prep · Sauce hält 4 Tage, gut einzufrieren',
    items: [
      ['Vollkorn Linguine', 400, 's801'],
      ['Beyond Meat Hack', 300, P.beyond, { u: [1, 'Packung'] }],
      ['Suppengemüse (Karotte, Sellerie, Lauch)', 350, 's355', { u: [1, 'Bund'] }],
      ['Zwiebel', 80, 's368', { u: [1, 'Stück'] }],
      ['Knoblauch', 6, 's356', { v: 1, u: [2, 'Zehen'] }],
      ['Gehackte Tomaten', 800, P.tomDose, { u: [2, 'Dosen'] }],
      ['Tomatenmark', 15, 's636', { v: 1, u: [1, 'EL'] }],
      ['Vegane Sahne', 100, P.kochsahne, { ml: 1 }],
      ['Öl', 20, 's600', { v: 1, u: [2, 'EL'] }],
      ['Oregano, Salz, Pfeffer, 1 Prise Zucker', 0, null, { v: 1, t: 'nach Geschmack' }]],
    steps: ['Suppengemüse, Zwiebel und Knoblauch sehr fein würfeln. Geht auch schnell im Zerkleinerer.',
      'Öl in einem großen Topf erhitzen, Hack krümelig und scharf anbraten (ca. 5 Min). Rausnehmen.',
      'Gemüse und Zwiebel in den Topf, 5 Min anbraten. Knoblauch und Tomatenmark 1 Min mitrösten.',
      'Optional mit 150 ml Rotwein ablöschen und fast komplett einkochen lassen.',
      'Tomaten, Hack, Oregano und Zucker dazu. Mind. 30 Min leise köcheln lassen, ab und zu umrühren. Je länger, desto besser.',
      'Sahne einrühren, mit Salz und Pfeffer abschmecken. Nudeln kochen und mit der Sauce servieren.'] },

  { sid: 'hummus', icon: '🫘', name: 'Hummus', servings: 4, meta: 'ca. 10 Min · 1 Schale · hält 4–5 Tage im Kühlschrank',
    items: [
      ['Kichererbsen (Dose, abgetropft)', 240, 's1059', { u: [1, 'Dose'] }],
      ['Tahin', 45, 's408', { u: [3, 'EL'] }],
      ['Zitrone (Saft)', 25, 's605', { u: [0.5, 'Stück'] }],
      ['Kreuzkümmel', 1, P.cumin, { v: 1, u: [0.5, 'TL'] }],
      ['Olivenöl (plus zum Beträufeln)', 30, 's591', { v: 1, u: [3, 'EL'] }],
      ['Knoblauch (optional)', 3, 's356', { v: 1, u: [1, 'Zehe'] }],
      ['Salz, Pfeffer, Paprikapulver', 0, null, { v: 1, t: 'nach Geschmack' }]],
    steps: ['Tahin und Zitronensaft im Mixer ca. 1 Min aufschlagen, bis es hell und cremig ist.',
      'Kichererbsen, Kreuzkümmel, Öl, Salz und Pfeffer dazugeben und mixen.',
      'Nach und nach 3–5 EL kaltes Wasser oder Kichererbsenwasser dazugeben, bis der Hummus schön cremig ist. 2–3 Min mixen lohnt sich.',
      'Abschmecken, in eine Schale geben, mit Olivenöl beträufeln und mit Paprikapulver bestreuen.'],
    tip: 'Für extra cremigen Hummus die Kichererbsen vorher 10 Min mit einer Prise Natron kochen.' },

  { sid: 'gurkentoast', icon: '🥪', name: 'Tofu-Gurkentoast', servings: 1, meta: 'ca. 10 Min',
    items: [
      ['Vollkorntoast', 60, 's825', { u: [2, 'Scheiben'] }],
      ['Veganer Frischkäse', 30, P.frisch, { u: [2, 'EL'] }],
      ['Räuchertofu', 100, 's14090', { u: [0.5, 'Block'] }],
      ['Gurke', 100, 's354', { u: [0.25, 'Stück'] }],
      ['Öl', 4, 's600', { v: 1, u: [1, 'TL'] }],
      ['Sriracha', 0, null, { v: 1, t: 'nach Geschmack' }]],
    steps: ['Tofu in dünne Scheiben schneiden und in Öl 2–3 Min pro Seite knusprig braten.',
      'Toast toasten, Gurke in dünne Scheiben schneiden.',
      'Toast mit Frischkäse bestreichen, Gurke und Tofu drauflegen, Sriracha drüber.'] },

  { sid: 'flammkuchen', icon: '🔥', name: 'Veganer Flammkuchen', servings: 2, meta: 'ca. 25 Min',
    items: [
      ['Flammkuchenteig (Kühlregal)', 260, P.teig, { u: [1, 'Rolle'] }],
      ['Vegane Creme (REWE)', 150, P.creme],
      ['Billie Green veganer Speck (Würfel)', 100, P.speck, { u: [1, 'Packung'] }],
      ['Zucchini (klein)', 150, 's367', { u: [1, 'Stück'] }],
      ['Rote Zwiebel', 80, 's368', { u: [1, 'Stück'] }],
      ['Knoblauch', 3, 's356', { v: 1, u: [1, 'Zehe'] }],
      ['Veganer Reibegenuss (Aldi)', 150, P.reibe],
      SALT],
    steps: ['Ofen nach Packungsangabe des Teigs vorheizen (meist 220 °C Ober-/Unterhitze).',
      'Creme mit gepresstem Knoblauch, Salz und Pfeffer verrühren und auf dem Teig verstreichen.',
      'Zucchini in sehr dünne Scheiben, Zwiebel in feine Ringe schneiden. Mit dem Speck auf dem Teig verteilen.',
      'Käse darüberstreuen.',
      '12–15 Min backen, bis der Rand goldbraun ist.'] },

  { sid: 'mac', icon: '🧀', name: 'Mac ’n’ Cheese', servings: 3, meta: 'ca. 30 Min · Meal Prep',
    items: [
      ['Nudeln (Makkaroni oder Hörnchen)', 300, 's800'],
      ['Seidentofu (Taifun)', 400, P.seiden, { u: [1, 'Packung'] }],
      ['Veganer Reibegenuss (Aldi)', 150, P.reibe],
      ['Brokkoli (klein)', 250, 's351', { u: [1, 'Stück'] }],
      ['Veganes Hack (Aldi)', 200, P.hackAldi],
      ['Hefeflocken', 15, 'b:hefeflocken', { v: 1, u: [3, 'EL'] }],
      ['Senf', 5, P.senf, { v: 1, u: [1, 'TL'] }],
      ['Paprika edelsüß, Knoblauchpulver', 2, 's663', { v: 1, u: [1, 'TL'] }],
      ['Kokosöl', 10, 's601', { v: 1, u: [1, 'EL'] }],
      SALT],
    steps: ['Nudeln in Salzwasser kochen. Brokkoli in kleine Röschen schneiden und die letzten 4 Min mitkochen. Abgießen.',
      'Hack in Öl krümelig und knusprig braten.',
      'Seidentofu, Hefeflocken, Senf und Gewürze glatt pürieren.',
      'Die Sauce in einem Topf erwärmen, Reibegenuss einrühren, bis er geschmolzen ist. Wenn’s zu dick ist, Pflanzenmilch dazu.',
      'Nudeln, Brokkoli und Hack untermischen und abschmecken.'],
    tip: 'Ofenversion: in eine Auflaufform geben, etwas Reibegenuss drüber und 10 Min bei 200 °C überbacken.' },

  { sid: 'geschnetzeltes', icon: '🍛', name: 'Veganes Geschnetzeltes', servings: 2, meta: 'ca. 35 Min · Meal Prep',
    items: [
      ['Sojaschnetzel (trocken)', 80, 's14147'],
      ['Vegane Kochsahne', 200, P.kochsahne, { ml: 1 }],
      ['Bratensaucenpulver', 25, P.braten, { u: [1, 'Packung'] }],
      ['Champignons', 250, 's375'],
      ['TK-Erbsen (REWE Bio)', 225, 's14219', { u: [0.5, 'Packung'] }],
      ['Kartoffeln (Beilage)', 500, 's813'],
      ['Sojasauce', 30, P.soja, { v: 1, u: [2, 'EL'], ml: 1 }],
      ['Knoblauch', 3, 's356', { v: 1, u: [1, 'Zehe'] }],
      ['Öl', 20, 's600', { v: 1, u: [2, 'EL'] }],
      ['Gemüsebrühe zum Einweichen', 0, null, { v: 1, t: 'etwas' }],
      SALT],
    steps: ['Sojaschnetzel ca. 10 Min in heißer Brühe einweichen, dann gut ausdrücken und mit Sojasauce mischen.',
      'In der Zeit die Kartoffeln kochen.',
      'Schnetzel in 1 EL Öl scharf anbraten, bis sie gebräunt sind (ca. 5 Min). Rausnehmen.',
      'Knoblauch hacken, Pilze in Scheiben schneiden und im restlichen Öl 5 Min anbraten.',
      'Bratensaucenpulver in kaltes Wasser rühren (Menge laut Packung), mit der Sahne in die Pfanne geben und aufkochen.',
      'Erbsen und Schnetzel dazu, 5 Min köcheln lassen. Mit Salz und Pfeffer abschmecken.'] },
];
})();
