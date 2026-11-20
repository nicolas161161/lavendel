# Datenbank aktualisieren

1. Excel von https://naehrwertdaten.ch/de/downloads/ laden (z. B. nach `C:\temp\swiss.xlsx`).
2. Aus dem Ordner `lavendel` ausführen:

       python -I tools/convert.py C:\temp\swiss.xlsx tools foods-db.js

3. `BASE_MAP` in `foods.js` prüfen (IDs der Startliste), Versionsnummer in `app.js` und `sw.js` erhöhen.
