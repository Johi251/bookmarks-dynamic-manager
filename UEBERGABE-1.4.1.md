# Bookmarks Dynamic Manager 1.4.1

Diese Fehlerkorrektur ergänzt die fehlende Dateiauswahl im Importdialog und gibt HTML5-Datei-Drop in der Windows-App frei.

## Installation

Unter `Downloads` liegen Windows-Setup und portable EXE, Mac-DMGs für Apple Silicon/Intel, Linux-DEB/AppImage und Chrome-/Firefox-ZIPs. Bestehende lokale Daten bleiben beim Aktualisieren erhalten. Für den Desktop die ältere App schließen und die Ausgabe 1.4.1 starten. Windows benötigt WebView2.

Chromium: ZIP entpacken und im Entwicklermodus laden. Firefox ab 128: temporär über `about:debugging`. Windows ist unsigniert, Mac nicht notarisiert, Firefox nicht dauerhaft signiert.

## Lesezeichen importieren

Im Browser vorhandene Lesezeichen als HTML exportieren. Im Manager `Import` öffnen und `Lesezeichen-HTML (Browser)` wählen. Die Fläche öffnet die Dateiauswahl; alternativ die HTML-/HTM-Datei auf diese Fläche ziehen. Nach dem Import erscheinen Ergebnis und neue Lesezeichen. JSON-Sicherungen verwenden die zweite Auswahl.

Die Oberfläche verarbeitet HTML5-Datei-Drop. Der native Tauri-Drop-Handler ist dafür abgeschaltet, da er diese Ereignisse unter Windows sonst abfängt. Das interne Ziehen von Lesezeichen verwendet ebenfalls HTML5.

## Daten und Integrationen

Web, Desktop und Browser-Erweiterung verwenden getrennte lokale Bestände. Für Austausch JSON/CSV exportieren und importieren. Der Ordner `Web-App` wird über HTTP bereitgestellt. Today's Hunt benötigt die laufende Desktop-App; automatische Clipboard-Übergabe zusätzlich copyNpaste. Die aKlik-Bridge benötigt den lokalen aKlik-Deployer auf Port 43110.

Die Hakenanimation ist im copyNpaste-Magazin implementiert. Eine Animation am ursprünglich kopierten Link in anderen Programmen und die vollständig ausgearbeitete Logo-Ausklappanimation sind nicht Bestandteil dieser Fehlerkorrektur.

Der zugehörige Prüfstatus steht unter `Quellcode/PRUEFSTATUS-1.4.1.md`. Eine eigene Vision-API bleibt optional und wurde nicht kostenpflichtig getestet.
