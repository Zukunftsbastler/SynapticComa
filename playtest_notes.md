# Playtest-noter

> Arbejdsdokument til løbende test af Synaptic Coma.
>
> Noterne skrives først på dansk, så de er nemme at gennemgå og justere. Når playtesten er færdig, oversættes dokumentet samlet til engelsk.

## Testprincip

Vi gennemgår én bane ad gangen med fokus på:

- layout og browserzoom
- bokse, tekst og knapper inden for skærmen
- forståelse af mål og regler
- styring og visuel feedback
- grafik, kontrast og læsbarhed
- fejl og uventet browseradfærd
- konkrete forbedringsforslag

---

# Overordnede observationer

## 1. Baneoversigten passer ikke på skærmen ved 100 % zoom

**Observation**  
Efter valg af **Local Game** vises baneoversigten. Ved 100 % browserzoom ligger bane 1 uden for det synlige område på den testede skærm. Der er ingen mulighed for at scrolle, så brugeren er nødt til at zoome ud for at kunne vælge bane 1.

**Problem**  
Baneoversigten tilpasser sig ikke browservinduets tilgængelige højde. Manglende scrolling gør dele af menuen utilgængelige.

**Forslag**

- Gør baneoversigten responsiv i forhold til browservinduets størrelse.
- Tilføj lodret scrolling, når indholdet er højere end vinduet.
- Overvej et responsivt gitter, som ændrer antal kolonner og rækker efter den tilgængelige plads.

**Prioritet:** Høj  
Spillet kan ikke startes normalt ved 100 % zoom på den testede skærm.

## 2. Tutorialen bliver stående efter Escape

**Observation**  
Hvis man trykker `Escape` under tutorialen i bane 1, kommer man tilbage til baneoversigten, men tutorialvinduet bliver stadig vist oven på oversigten.

**Problem**  
Tutorialens overlay eller state afsluttes ikke, når banen forlades.

**Forslag**

- Luk og nulstil tutorialens overlay/state, når spilleren forlader en bane.
- Beslut tydeligt, om tutorialen skal begynde forfra eller fortsætte, når banen åbnes igen.
- Tilføj en test af, at ingen bane- eller tutorialelementer bliver stående efter `Escape`.

**Prioritet:** Høj  
Fejlen dækker baneoversigten og giver indtryk af, at spillet stadig befinder sig i banen.

---

# Bane 1

## Shared Unlock er ikke nødvendig for at gennemføre banen

**Observation**  
Bane 1 kan gennemføres uden at begge spillere lander på **Shared Unlock**. Spillerne kan gå direkte til udgangene uden at bruge den mekanik, som banen ser ud til at skulle introducere.

**Problem**  
Hvis formålet med bane 1 er at lære spilleren Shared Unlock og den fælles AP-pulje, lærer banen kun mekanikken gennem tekst og ikke gennem nødvendig handling.

**Spørgsmål**  
Er det bevidst, at Shared Unlock er valgfri, eller skal banen kræve, at spillerne aktiverer den?

**Forslag**  
Hvis Shared Unlock skal læres i bane 1, bør banen udformes, så den ikke kan gennemføres uden aktivering. Det kan for eksempel ske ved at:

- reducere startmængden af AP,
- ændre spillernes eller udgangenes placering,
- placere Shared Unlock naturligt på den nødvendige rute,
- eller lade tutorialen vente, indtil begge spillere har aktiveret den.

Den ønskede læringsrækkefølge kan være:

1. Bevægelse koster AP.
2. Spillerne deler samme AP-pulje.
3. Begge spillere skal koordinere deres bevægelser.
4. Shared Unlock giver de AP, der er nødvendige for at fortsætte.
5. Spillerne gennemfører banen i den korrekte rækkefølge.

**Prioritet:** Høj  
Det er en central mekanik, som den første bane ellers ikke kræver, at spilleren anvender.

---

# Bane 2

## 1. Tutorialteksten kan ikke læses fuldt ud

**Observation**  
Hele tutorialteksten kan ikke læses på den testede skærm. De nederste dele af tekstboksen er ikke synlige.

**Problem**  
Tutorialen kræver en bestemt handling for at fortsætte, men spilleren kan ikke læse hele instruktionen. Der er samtidig ingen tydelig scrollmulighed i boksen.

**Forslag**

- Gør tutorialboksen responsiv.
- Opdel lange instruktioner i flere korte trin.
- Tilføj intern scrolling, hvis teksten ikke kan være i boksen.
- Sørg for, at hele teksten kan læses ved 100 % browserzoom.

**Prioritet:** Høj  
Spilleren kan blive blokeret, fordi den nødvendige instruktion ikke er synlig.

## 2. Den lovede blinkende fremhævelse vises ikke

**Observation**  
Tutorialen fortæller, at en relevant plade og/eller indsætningspilene skal blinke eller lyse op. Under testen blinkede pladen ikke, og pilene ved matrixen blev heller ikke tydeligt fremhævet.

**Problem**  
Spilleren kan ikke se, hvilken plade der skal vælges, eller hvor der efterfølgende skal klikkes. Det er ekstra problematisk, fordi hele tutorialteksten heller ikke kan læses.

**Forslag**

- Giv den relevante plade en tydelig pulserende ramme.
- Fremhæv gyldige indsætningspile tydeligt, når pladen er valgt.
- Flyt tutorialens visuelle fokus fra pladen til pilene efter første handling.
- Opdel instruktionen i to korte trin: **Vælg pladen** og **Klik på den fremhævede pil**.
- Vis en forklaring, hvis der ikke findes en gyldig handling, i stedet for blot at lade tutorialen vente.

**Prioritet:** Høj  
Tutorialen kan ikke pålideligt guide spilleren gennem den handling, den forsøger at lære.

## 3. Den låste passage blokerer ikke spillerne

**Observation**  
Begge spillere kan gennemføre bane 2 ved blot at gå `op, op, op`. Det er ikke nødvendigt at flytte eller indsætte en plade i matrixen, og den passage, der ser ud til at være låst, stopper ikke spillerne.

**Problem**  
Banens centrale mekanik kan springes helt over. Spilleren behøver derfor ikke at lære at:

- vælge en plade,
- indsætte den i matrixen,
- aktivere `UNLOCK`,
- eller forstå sammenhængen mellem matrixen og banen.

**Forslag**

- Sørg for, at den låste passage fysisk eller logisk blokerer bevægelse, indtil `UNLOCK` er aktiv.
- Kontrollér lågens tilstand i bevægelsessystemet, før en spiller får lov til at træde ind på eller passere det relevante felt eller den relevante kant.
- Tilføj automatiske tests, som bekræfter:
  1. Spilleren kan ikke passere før aktivering.
  2. `UNLOCK` åbner passagen.
  3. Spilleren kan passere efter aktivering.
  4. Banens løsning faktisk kræver brug af matrixen.

**Prioritet:** Kritisk  
Bane 2 fungerer ikke som den tiltænkte introduktion til matrix- og unlock-mekanikken.

---

# Foreløbig status

Playtesten er foreløbig nået gennem bane 1 og bane 2. Næste test starter med bane 3 og fortsætter samtidig med kontrol af de overordnede problemer med zoom, responsivt layout, tutorialbokse og browseradfærd.
