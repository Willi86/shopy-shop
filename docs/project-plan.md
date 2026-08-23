# Projektplan

## Mål

Målet är att utveckla en fungerande e-handel där kunder kan se produkter, lägga produkter i en varukorg och genomföra en checkout som skapar en order i databasen.

Administratörer ska kunna logga in, hantera produkter, se inkomna ordrar och hantera orderstatus.

Projektet utvecklas för att uppfylla kraven för betyget VG.

## Teknik

Projektet använder:

- React
- TypeScript
- Vite
- Supabase
- PostgreSQL
- Supabase Auth
- Tailwind CSS
- React Router
- Git
- GitHub
- Vercel

## Tidsplan

### Dag 1 – Projektstart och planering

- Skapa GitHub Classroom-projekt
- Skapa React- och TypeScript-projekt
- Skapa projektstruktur
- Skapa databasdiagram
- Skapa sitemap
- Skapa tidsplan

### Dag 2 – Databas och Supabase

- Skapa Supabase-projekt
- Skapa databastabeller
- Konfigurera anslutning mellan React och Supabase
- Skapa produkttabell
- Lägg till testdata
- Testa databasanslutningen

### Dag 3 – Produkter och grundläggande UI

- Skapa grundläggande layout
- Skapa header och navigering
- Hämta produkter från Supabase
- Visa produktlista
- Skapa produktkort
- Skapa responsiv produktlayout

### Dag 4 – Produktdetaljer och varukorg

- Skapa produktdetaljsida
- Skapa varukorg
- Lägg till produkter i varukorgen
- Ta bort produkter från varukorgen
- Ändra antal produkter
- Hantera lagergränser
- Visa totalsumma

### Dag 5 – Checkout och order

- Skapa checkout
- Skapa kundformulär
- Validera kunduppgifter
- Skapa order i databasen
- Skapa orderrader
- Spara produktnamn, pris och antal vid beställning
- Töm varukorgen efter genomförd beställning

### Dag 6 – Autentisering och behörighet

- Implementera Supabase Auth
- Skapa användarprofiler
- Implementera användarroller
- Skapa administratörsroll
- Skydda adminsidor
- Kontrollera administratörsbehörighet

### Dag 7 – Produktadministration

- Skapa adminpanel
- Visa produkter i adminpanelen
- Lägg till produkter
- Redigera produkter
- Validera produktformulär
- Spara produktändringar i Supabase

### Dag 8 – Orderadministration

- Visa ordrar i adminpanelen
- Visa kundinformation
- Visa beställda produkter
- Implementera orderhantering
- Implementera betalningsstatus
- Implementera leveransstatus
- Implementera returstatus
- Lägg till transportör och spårningsnummer
- Lägg till återbetalningshantering
- Lägg till viktiga ordertidsstämplar
- Skapa orderhistorik
- Spara administratörens ändringar i databasen

### Dag 9 – Persistent varukorg och UX

- Spara varukorgen i databasen
- Implementera anonym Supabase-session för gäster
- Återställ varukorgen efter omladdning
- Förbättra responsiv design
- Lägg till loading states
- Lägg till felmeddelanden
- Lägg till empty states
- Lägg till feedbackmeddelanden/toasts
- Testa autentisering och utloggning
- Testa kund- och adminflöden

### Dag 10 – Sluttest och leverans

- Testa hela kundflödet
- Testa produktadministrationen
- Testa orderadministrationen
- Testa persistent varukorg
- Testa behörigheter
- Köra ESLint
- Köra produktionsbuild
- Fixa kvarvarande buggar
- Uppdatera dokumentation
- Uppdatera README
- Deploya projektet
- Testa den deployade versionen
- Kontrollera Git-historik
- Kontrollera att samtliga G- och VG-krav är uppfyllda

## Slutmål

Projektet ska efter utvecklingsperioden innehålla ett komplett grundflöde för e-handel:

```text
Produkter
    ↓
Produktdetaljer
    ↓
Varukorg
    ↓
Checkout
    ↓
Order
    ↓
Adminpanel
    ↓
Orderhantering
```

Dessutom ska varukorgen vara persistent och administratörsfunktionerna skyddas genom autentisering och roller.
