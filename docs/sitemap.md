# Sitemap

Sitemapen visar vilka sidor som finns i e-handeln och hur kunden respektive administratören navigerar genom applikationen.

## Publika sidor

```text
/
│
├── Produkter
│   └── /products
│       │
│       └── Produktdetaljer
│           └── /products/:id
│
├── Varukorg
│   └── /cart
│       │
│       └── Checkout
│           └── /checkout
│
└── Login
    └── /login
```

## Administratör

Administratörssidorna kräver att användaren är inloggad och har rollen `admin`.

```text
/admin
│
├── Orderhantering
│   └── /admin
│
└── Produkthantering
    └── /admin/products
```

## Fullständig sitemap

```text
/
│
├── /products
│   └── /products/:id
│
├── /cart
│   └── /checkout
│
├── /login
│
└── /admin
    └── /admin/products
```

## Sidbeskrivningar

| Route             | Sida             | Åtkomst | Beskrivning                                               |
| ----------------- | ---------------- | ------- | --------------------------------------------------------- |
| `/`               | Startsida        | Alla    | Webbutikens startsida                                     |
| `/products`       | Produkter        | Alla    | Visar alla produkter                                      |
| `/products/:id`   | Produktdetaljer  | Alla    | Visar information om en specifik produkt                  |
| `/cart`           | Varukorg         | Alla    | Visar produkter som kunden lagt i varukorgen              |
| `/checkout`       | Checkout         | Alla    | Kunduppgifter och skapande av order                       |
| `/login`          | Login            | Alla    | Inloggning för registrerade användare och administratörer |
| `/admin`          | Orderhantering   | Admin   | Visar och hanterar inkomna ordrar                         |
| `/admin/products` | Produkthantering | Admin   | Lägger till och redigerar produkter                       |

## Kundflöde

```text
Startsida
    ↓
Produkter
    ↓
Produktdetaljer
    ↓
Varukorg
    ↓
Checkout
    ↓
Order skapas
```

Kunden kan även lägga produkter i varukorgen direkt från produktlistan.

## Adminflöde

```text
Login
    ↓
Admin
    ├── Orderhantering
    │
    └── Produkthantering
```

Administratören kan från adminområdet:

- se inkomna ordrar
- se vilka produkter som beställts
- hantera orderstatus
- hantera betalningsstatus
- hantera leveransstatus
- hantera returer
- lägga till produkter
- redigera produkter

## Behörighet

De publika sidorna kan användas utan administratörsbehörighet.

Adminområdet skyddas av applikationens autentisering och rollkontroll:

```text
Ej inloggad
    ↓
/admin
    ↓
/login

Inloggad utan admin-roll
    ↓
/admin
    ↓
Åtkomst nekad

Inloggad administratör
    ↓
/admin
    ↓
Åtkomst beviljad
```
