# Databasdiagram

Projektet använder en relationsdatabas för produkter, användare, varukorgar och ordrar.

## Tabeller

### profiles

Innehåller extra information om användare.

| Kolumn     | Typ       | Beskrivning                                        |
| ---------- | --------- | -------------------------------------------------- |
| id         | uuid      | Primärnyckel och koppling till användarens auth-id |
| email      | text      | Användarens e-postadress                           |
| role       | text      | Användarroll, exempelvis `customer` eller `admin`  |
| created_at | timestamp | När profilen skapades                              |

### products

Innehåller alla produkter som visas i webbutiken.

| Kolumn      | Typ       | Beskrivning                   |
| ----------- | --------- | ----------------------------- |
| id          | uuid      | Produktens primärnyckel       |
| name        | text      | Produktens namn               |
| description | text      | Produktbeskrivning            |
| price       | numeric   | Produktens pris               |
| image_url   | text      | Länk till produktbild         |
| stock       | integer   | Antal produkter i lager       |
| created_at  | timestamp | När produkten skapades        |
| updated_at  | timestamp | När produkten senast ändrades |

### carts

Representerar en användares varukorg.

| Kolumn     | Typ       | Beskrivning                    |
| ---------- | --------- | ------------------------------ |
| id         | uuid      | Varukorgens primärnyckel       |
| user_id    | uuid      | Koppling till användaren       |
| created_at | timestamp | När varukorgen skapades        |
| updated_at | timestamp | När varukorgen senast ändrades |

### cart_items

Innehåller produkterna som ligger i en varukorg.

| Kolumn     | Typ     | Beskrivning              |
| ---------- | ------- | ------------------------ |
| id         | uuid    | Primärnyckel             |
| cart_id    | uuid    | Koppling till varukorgen |
| product_id | uuid    | Koppling till produkten  |
| quantity   | integer | Antal av produkten       |

### orders

Innehåller skapade ordrar.

| Kolumn      | Typ       | Beskrivning                   |
| ----------- | --------- | ----------------------------- |
| id          | uuid      | Orderns primärnyckel          |
| user_id     | uuid      | Användaren som skapade ordern |
| status      | text      | Orderstatus                   |
| total_price | numeric   | Totalt ordervärde             |
| created_at  | timestamp | När ordern skapades           |

Möjliga orderstatusar:

- Beställd
- Behandlas
- Levererad
- Återbetald

### order_items

Innehåller produkterna som tillhör en order.

| Kolumn       | Typ     | Beskrivning                       |
| ------------ | ------- | --------------------------------- |
| id           | uuid    | Primärnyckel                      |
| order_id     | uuid    | Koppling till ordern              |
| product_id   | uuid    | Koppling till produkten           |
| product_name | text    | Produktens namn vid köptillfället |
| price        | numeric | Produktens pris vid köptillfället |
| quantity     | integer | Antal beställda                   |

## Relationer

```text
profiles
   |
   | 1
   |
   | *
carts
   |
   | 1
   |
   | *
cart_items
   |
   | *
   |
   | 1
products


profiles
   |
   | 1
   |
   | *
orders
   |
   | 1
   |
   | *
order_items
   |
   | *
   |
   | 1
products
```
