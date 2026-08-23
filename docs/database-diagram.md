# Databasdiagram

Projektet använder Supabase med PostgreSQL som relationsdatabas.

Databasen hanterar:

- användarprofiler och roller
- produkter
- persistenta varukorgar
- varukorgsprodukter
- ordrar
- orderrader
- orderstatus, betalning, leverans och returer
- orderhistorik

Supabase Auth används för autentisering.

Både registrerade användare, administratörer och anonyma gästanvändare kan ha ett Supabase Auth-ID. Detta gör att även en gästs varukorg kan sparas i databasen och finnas kvar efter att sidan laddas om.

---

## Tabeller

### auth.users

Supabase Auth hanterar användarkonton och autentisering.

Tabellen hanteras av Supabase och används bland annat för:

- administratörsinloggning
- vanliga användare
- anonyma gästanvändare
- koppling till profiler
- koppling till persistenta varukorgar

Viktiga fält som används av projektet:

| Kolumn       | Typ     | Beskrivning                             |
| ------------ | ------- | --------------------------------------- |
| id           | uuid    | Användarens unika Auth-ID               |
| email        | text    | E-postadress för registrerade användare |
| is_anonymous | boolean | Anger om användaren är en anonym gäst   |

---

### profiles

Innehåller projektets kompletterande användarinformation och roller.

| Kolumn     | Typ       | Beskrivning                                       |
| ---------- | --------- | ------------------------------------------------- |
| id         | uuid      | Primärnyckel och koppling till `auth.users.id`    |
| email      | text      | Användarens e-postadress                          |
| role       | text      | Användarroll, exempelvis `customer` eller `admin` |
| created_at | timestamp | När profilen skapades                             |

En administratör identifieras genom:

```text
profiles.role = admin
```

Administratörsrollen används för att skydda funktioner som produkt- och orderhantering.

---

### products

Innehåller alla produkter som visas i webbutiken.

| Kolumn      | Typ       | Beskrivning                   |
| ----------- | --------- | ----------------------------- |
| id          | uuid      | Produktens primärnyckel       |
| name        | text      | Produktens namn               |
| description | text      | Produktbeskrivning            |
| price       | numeric   | Produktens pris               |
| image_url   | text      | URL till produktbild          |
| stock       | integer   | Antal produkter i lager       |
| category    | text      | Produktens kategori           |
| created_at  | timestamp | När produkten skapades        |
| updated_at  | timestamp | När produkten senast ändrades |

Produkter hämtas från databasen och visas för kunder i webbutiken.

Administratörer kan lägga till och redigera produkter via adminpanelen.

---

### carts

Representerar en persistent varukorg.

Varukorgen är kopplad till ett Supabase Auth-ID. Det innebär att även en anonym gästanvändare kan ha en varukorg som finns kvar efter omladdning av webbsidan.

| Kolumn     | Typ       | Beskrivning                    |
| ---------- | --------- | ------------------------------ |
| id         | uuid      | Varukorgens primärnyckel       |
| user_id    | uuid      | Koppling till `auth.users.id`  |
| created_at | timestamp | När varukorgen skapades        |
| updated_at | timestamp | När varukorgen senast ändrades |

Varje användare eller anonym gäst kan ha en egen persistent varukorg.

Row Level Security används för att begränsa åtkomsten till användarens egen varukorg.

---

### cart_items

Innehåller produkterna som ligger i en varukorg.

| Kolumn     | Typ     | Beskrivning                 |
| ---------- | ------- | --------------------------- |
| id         | uuid    | Primärnyckel                |
| cart_id    | uuid    | Koppling till `carts.id`    |
| product_id | uuid    | Koppling till `products.id` |
| quantity   | integer | Antal av produkten          |

Varje rad representerar en produkt och dess antal i en specifik varukorg.

Varukorgens innehåll sparas i databasen och kan därför återställas efter att användaren laddar om sidan.

---

### orders

Innehåller skapade ordrar.

Ordern innehåller kundinformation, totalsumma samt separata statusfält för order, betalning, leverans och retur.

| Kolumn              | Typ       | Beskrivning                                                   |
| ------------------- | --------- | ------------------------------------------------------------- |
| id                  | uuid      | Orderns primärnyckel                                          |
| user_id             | uuid      | Koppling till användaren om tillgänglig                       |
| customer_name       | text      | Kundens namn                                                  |
| customer_email      | text      | Kundens e-postadress                                          |
| customer_address    | text      | Kundens leveransadress                                        |
| postal_code         | text      | Kundens postnummer                                            |
| city                | text      | Kundens stad                                                  |
| total_price         | numeric   | Orderns totala värde                                          |
| status              | text      | Äldre orderstatus som finns kvar från tidigare implementation |
| order_status        | text      | Övergripande orderstatus                                      |
| payment_status      | text      | Betalningsstatus                                              |
| fulfillment_status  | text      | Behandlings- och leveransstatus                               |
| return_status       | text      | Returstatus                                                   |
| carrier             | text      | Transportör                                                   |
| tracking_number     | text      | Spårningsnummer                                               |
| refund_amount       | numeric   | Återbetalat belopp                                            |
| admin_note          | text      | Intern administratörsanteckning                               |
| paid_at             | timestamp | När ordern markerades som betald                              |
| packed_at           | timestamp | När ordern packades                                           |
| shipped_at          | timestamp | När ordern skickades                                          |
| delivered_at        | timestamp | När ordern levererades                                        |
| cancelled_at        | timestamp | När ordern avbröts                                            |
| return_requested_at | timestamp | När retur begärdes                                            |
| returned_at         | timestamp | När returen mottogs                                           |
| created_at          | timestamp | När ordern skapades                                           |
| updated_at          | timestamp | När ordern senast ändrades                                    |

#### Orderstatus

```text
active
completed
cancelled
```

#### Betalningsstatus

```text
pending
paid
failed
partially_refunded
refunded
```

#### Leveransstatus

```text
unfulfilled
processing
packed
shipped
out_for_delivery
delivered
```

#### Returstatus

```text
none
requested
approved
rejected
in_transit
received
damaged
refunded
replacement_requested
replacement_sent
```

Statusarna är separerade eftersom betalning, orderhantering, leverans och retur representerar olika delar av en orders livscykel.

Exempel på en aktiv order som har betalats och skickats:

```text
order_status       = active
payment_status     = paid
fulfillment_status = shipped
return_status      = none
```

---

### order_items

Innehåller produkterna som tillhör en order.

| Kolumn       | Typ     | Beskrivning                       |
| ------------ | ------- | --------------------------------- |
| id           | uuid    | Primärnyckel                      |
| order_id     | uuid    | Koppling till `orders.id`         |
| product_id   | uuid    | Koppling till `products.id`       |
| product_name | text    | Produktens namn vid köptillfället |
| price        | numeric | Produktens pris vid köptillfället |
| quantity     | integer | Antal beställda                   |

Produktnamn och pris sparas i orderraden.

Det gör att en gammal order fortfarande kan visa informationen från köptillfället även om produktens namn eller pris senare ändras.

---

### order_status_history

Innehåller historik över ändringar som görs på en order.

Tabellen fungerar som en audit log och gör det möjligt att se hur en order har förändrats över tid.

| Kolumn     | Typ       | Beskrivning                          |
| ---------- | --------- | ------------------------------------ |
| id         | uuid      | Primärnyckel                         |
| order_id   | uuid      | Koppling till `orders.id`            |
| changed_by | uuid      | Administratören som gjorde ändringen |
| field_name | text      | Vilket fält som ändrades             |
| old_value  | text      | Tidigare värde                       |
| new_value  | text      | Nytt värde                           |
| note       | text      | Kommentar till ändringen             |
| created_at | timestamp | När ändringen gjordes                |

Exempel på ändring:

```text
payment_status
pending
→
paid
```

Ett annat exempel:

```text
fulfillment_status
packed
→
shipped
```

Administratören kan även lägga till en kommentar till ändringen.

Orderuppdateringen och skapandet av historik hanteras tillsammans för att undvika att en order ändras utan att motsvarande historik sparas.

---

## Relationer

Databasens viktigaste relationer kan beskrivas så här:

```text
                    ┌──────────────────┐
                    │    auth.users    │
                    └────────┬─────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 │ 1                     │ 1
                 ▼                       ▼
          ┌────────────┐          ┌────────────┐
          │  profiles  │          │   carts    │
          └────────────┘          └─────┬──────┘
                                        │
                                        │ 1
                                        │
                                        │ *
                                  ┌─────▼───────┐
                                  │ cart_items  │
                                  └─────┬───────┘
                                        │
                                        │ *
                                        │
                                        │ 1
                                  ┌─────▼───────┐
                                  │  products   │
                                  └─────────────┘


                    ┌──────────────────┐
                    │    auth.users    │
                    └────────┬─────────┘
                             │
                             │ 1
                             │
                             │ *
                             ▼
                       ┌────────────┐
                       │   orders   │
                       └─────┬──────┘
                             │
                 ┌───────────┴────────────┐
                 │                        │
                 │ 1                      │ 1
                 │                        │
                 ▼                        ▼
          ┌──────────────┐      ┌──────────────────────┐
          │ order_items  │      │ order_status_history │
          └──────┬───────┘      └──────────────────────┘
                 │
                 │ *
                 │
                 │ 1
                 ▼
          ┌──────────────┐
          │   products   │
          └──────────────┘
```

---

## Relationsöversikt

De viktigaste relationerna är:

```text
auth.users 1 ─── 1 profiles

auth.users 1 ─── * carts
carts      1 ─── * cart_items
products   1 ─── * cart_items

auth.users 1 ─── * orders
orders     1 ─── * order_items
products   1 ─── * order_items

orders     1 ─── * order_status_history
```

---

## Säkerhet

Projektet använder Supabase Auth och Row Level Security (RLS).

Säkerheten används bland annat för att:

- identifiera användare
- skapa anonyma gästsessioner
- skydda användarnas varukorgar
- begränsa administratörsfunktioner
- skydda produktadministrationen
- skydda orderadministrationen

Vanliga kunder ska inte kunna komma åt administratörens funktioner för att redigera produkter eller hantera ordrar.

Administratörens roll hämtas från `profiles`.

Exempel:

```text
role = admin
```

Adminrutterna i applikationen är också skyddade så att endast en inloggad administratör kan komma åt dem.

---

## Varukorgsflöde

Varukorgen sparas i databasen istället för att endast finnas i React state.

```text
Besökare öppnar webbutiken
        ↓
Supabase Auth-session kontrolleras
        ↓
Ingen session?
        ↓
Anonym session skapas
        ↓
Användarens cart hämtas eller skapas
        ↓
Produkten läggs i varukorgen
        ↓
cart_items sparas i databasen
        ↓
Sidan laddas om
        ↓
Varukorgen hämtas från databasen
        ↓
Produkten finns fortfarande kvar
```

Detta gör varukorgen persistent.

---

## Orderflöde

Ett förenklat orderflöde är:

```text
Produkt
   ↓
Varukorg
   ↓
cart_items sparas i databasen
   ↓
Checkout
   ↓
Kunden anger sina uppgifter
   ↓
Order skapas
   ↓
order_items skapas
   ↓
Administratören ser ordern
   ↓
Ordern behandlas
   ↓
Betalning registreras
   ↓
Ordern packas
   ↓
Transportör och spårningsnummer anges
   ↓
Ordern skickas
   ↓
Ordern levereras
```

---

## Returflöde

Systemet har även stöd för retur och återbetalning.

Ett möjligt returflöde är:

```text
Levererad order
      ↓
Retur begärd
      ↓
Retur godkänd
      ↓
Retur på väg
      ↓
Retur mottagen
      ↓
Återbetalning
```

Systemet har även stöd för ersättningsvara:

```text
Retur / problem
      ↓
Ersättningsvara begärd
      ↓
Ersättningsvara skickad
```

---

## Administratörens orderhantering

Administratören kan se skapade ordrar och vilka produkter som har beställts.

För varje order kan administratören hantera:

- orderstatus
- betalningsstatus
- leveransstatus
- returstatus
- transportör
- spårningsnummer
- återbetalningsbelopp
- interna anteckningar
- kommentar till orderhistoriken

Systemet sparar även viktiga tidpunkter, exempelvis:

- när betalningen registrerades
- när ordern packades
- när ordern skickades
- när ordern levererades
- när ordern avbröts
- när retur begärdes
- när retur mottogs

---

## Sammanfattning

Databasen är uppbyggd kring följande huvudområden:

```text
AUTH
│
├── auth.users
└── profiles

PRODUKTER
│
└── products

VARUKORG
│
├── carts
└── cart_items

ORDER
│
├── orders
├── order_items
└── order_status_history
```

Strukturen gör det möjligt för webbutiken att hantera hela flödet från produktvisning och persistent varukorg till checkout, orderhantering, leverans, retur och orderhistorik.
