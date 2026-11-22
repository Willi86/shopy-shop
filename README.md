# Shopy Shop – E-handel med externa integrationer

Shopy Shop är en e-handelsapplikation utvecklad som en del av utbildningen Systemutvecklare vid Medieinstitutet.

Projektet bygger på en befintlig webbshop som har vidareutvecklats med externa tjänster för produktimport, produktsökning, betalningar, frakt och molnlagring av produktbilder.

## Teknikstack

### Frontend

- React
- TypeScript
- Vite
- CSS

### Backend

- Node.js
- Express
- JavaScript
- REST API

### Databas och externa tjänster

- Supabase – PostgreSQL och Storage
- Algolia – produktsökning
- Stripe – betalningar i testläge
- Externt leverantörs-API – produktimport via CSV och XML
- Serverbaserad fraktintegration (mock)

## Projektets funktioner

### Produktimport – Labb 1

Administratören kan importera produktdata från en extern leverantör.

Importen stöder:

- CSV och XML
- Validering av produktdata
- Hantering av felaktiga poster
- Mappning till den egna produktmodellen
- Uppdatering av befintliga produkter
- Rapportering av importresultat

Produkterna lagras i Supabase.

### Produktsökning – Labb 2

Webbshoppen använder Algolia för produktsökning.

Sökningen sker genom det egna Express-API:et. Detta gör att applikationen kan kontrollera och validera sökparametrar innan förfrågan skickas vidare.

Integrationen stödjer fritextsökning och paginering.

### Stripe Checkout – Labb 3

Stripe används för betalningar i testläge.

Betalningsflödet:

1. Kunden lägger produkter i varukorgen.
2. Backend validerar beställningen.
3. En obetald order registreras.
4. Backend skapar en Stripe Checkout-session.
5. Kunden skickas till Stripe för betalning.
6. Stripe skickar en signerad webhook till backend.
7. Backend verifierar betalningen.
8. Ordern markeras som betald.
9. Produkternas lagersaldo uppdateras.
10. Kunden ser beställningens betalningsstatus.

Betalningslogiken är utformad så att samma order inte behandlas som en ny betalning flera gånger.

#### Genomförda betalningstester

Följande har verifierats lokalt:

- En Checkout-session skapas med status `open`.
- En lyckad betalning ändrar sessionen till `complete`.
- Ordern ändras till `paid`.
- Lageravdrag registreras.
- En nekad kortbetalning lämnar ordern obetald.
- Kunden kan försöka betala igen med ett annat kort.
- En utgången Checkout-session registreras som `expired`.
- Upprepad betalningsbehandling ger `already_paid`.
- En upprepad behandling minskar inte lagersaldot igen.

**Känd begränsning:** En utgången betalningssession kan lämna ordern som `pending`. Detta behöver kontrolleras mot uppgiftens krav på avbrutna ordrar.

### Produktbilder – Labb 4

Produktbilder lagras i Supabase Storage.

**Storage-bucket:** `product-images`

Administratören kan skapa, redigera och ta bort produkter samt hantera produktbilder genom administrationsgränssnittet.

Bilduppladdning sker genom Express-backend i stället för direkt från webbläsaren till Supabase Storage.

Flödet är:

1. Administratören väljer en produktbild.
2. React skickar bilden till Express-API:et.
3. Backend verifierar administratörens behörighet.
4. Bildens format och storlek valideras.
5. Bilden laddas upp till Supabase Storage.
6. Bildens publika URL sparas i produkttabellen.
7. Bilden visas i webbshoppen.

Implementationen stödjer JPEG/JPG med en maximal filstorlek på 5 MB.

Backend använder unika filnamn för nya bilder och erbjuder en separat endpoint för borttagning av oanvända bilder.

När en produkt uppdateras kan en ny bild laddas upp och ersätta den gamla. När en produkt tas bort hanteras även borttagning av dess bild genom backend.

### Frakt – Labb 5

Webbshoppen har en serverbaserad fraktintegration med mock-data.

Fraktlogiken hanteras i backend och är separerad från frontend, vilket gör det möjligt att senare ersätta mock-tjänsten med en riktig fraktleverantör.

Den befintliga implementationen används för att simulera fraktinformation i beställningsflödet.

## Kom igång lokalt

### Förutsättningar

- Node.js
- npm
- Git
- Supabase-projekt
- Stripe-konto i testläge
- Algolia-konto
- Tillgång till leverantörens API

### 1. Klona projektet

```bash
git clone https://github.com/Willi86/shopy-shop.git
cd shopy-shop
```

Repositoryt kan vara privat. I så fall krävs behörighet för att klona det.

### 2. Installera beroenden

Installera frontend från projektets rotmapp:

```bash
npm install
```

Installera backend:

```bash
cd server
npm install
```

Gå tillbaka till rotmappen:

```bash
cd ..
```

### 3. Konfigurera miljövariabler

Projektet använder separata miljövariabler för frontend och backend.

Det finns två exempelfiler:

- `.env.example` – frontend
- `server/.env.example` – backend

Kopiera exempelfilerna till riktiga `.env`-filer.

#### Frontend

Skapa `.env` i projektets rotmapp.

I PowerShell:

```powershell
Copy-Item .env.example .env
```

Frontend använder:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_API_URL=http://localhost:3001
```

Ersätt platshållarna med uppgifterna från Supabase.

#### Backend

Skapa `server/.env`.

I PowerShell, från projektets rotmapp:

```powershell
Copy-Item server/.env.example server/.env
```

Backend använder:

```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SECRET_KEY

TEST_PAYMENT_WEBHOOK_SECRET=YOUR_TEST_PAYMENT_WEBHOOK_SECRET

STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
```

Ange de riktiga nycklarna i `server/.env`.

**Viktigt:**

- Lägg aldrig riktiga hemliga nycklar i `.env.example`.
- Publicera aldrig `server/.env` på GitHub.
- Variabler som börjar med `VITE_` exponeras för webbläsaren.
- Supabase service-role-nyckeln och Stripes hemliga nycklar får endast användas på backend.
- Kontrollera att `.gitignore` utesluter `.env`-filer men tillåter `.env.example`.

Ytterligare konfiguration för externa tjänster ska dokumenteras om den används av projektet.

### 4. Starta backend

Öppna en terminal i projektets rotmapp:

```bash
cd server
npm run dev
```

Backend använder normalt:

`http://localhost:3001`

Kontrollera att servern fungerar:

`http://localhost:3001/api/health`

### 5. Starta frontend

Öppna en ny terminal i projektets rotmapp:

```bash
npm run dev
```

Frontend använder normalt:

`http://localhost:5173`

### 6. Testa Stripe lokalt

Stripe används i testläge.

För att ta emot webhook-händelser lokalt behöver Stripe CLI köras.

Exempel för Windows PowerShell:

```powershell
C:\stripe\stripe.exe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to http://localhost:3001/api/stripe/webhook
```

Ange webhook-signeringnyckeln från den aktuella Stripe CLI-sessionen i backendmiljön:

```env
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
```

Starta om backend efter att miljövariabeln har ändrats.

#### Testkort – lyckad betalning

```text
Kortnummer: 4242 4242 4242 4242
Utgångsdatum: 12/28
CVC: 123
```

#### Testkort – nekad betalning

```text
Kortnummer: 4000 0000 0000 0002
Utgångsdatum: 12/28
CVC: 123
```

Inga riktiga pengar används vid testbetalningarna.

#### Testa betalningsflödet

1. Starta frontend och backend.
2. Starta Stripe CLI.
3. Öppna webbshoppen.
4. Lägg en produkt i varukorgen.
5. Gå till kassan.
6. Starta Stripe Checkout.
7. Genomför betalningen med ett testkort.
8. Kontrollera att ordern registreras som betald.
9. Kontrollera att lagersaldot uppdateras.

För att testa en nekad betalning används testkortet för nekade betalningar.

Kunden ska då kunna försöka igen med ett giltigt testkort.

## Deployment

**Deployad webbshop:** [LÄGG IN DIN DEPLOYADE URL HÄR]

**GitHub-repository:**

https://github.com/Willi86/shopy-shop

Applikationen är driftsatt med frontend och backend.

Miljövariabler konfigureras i respektive hostingmiljö.

Stripe använder en webhook-endpoint som är tillgänglig från internet.

Hemliga API-nycklar och autentiseringsuppgifter lagras på backend och ska aldrig exponeras i frontend.

---

# Reflektion – Integration av tredjepartssystem

## 1. Integrationsmodeller och varför de används

I Shopy Shop använder jag flera integrationsmodeller beroende på vad den externa tjänsten erbjuder och vilken funktion som ska lösas.

Produktimporten använder ett REST-baserat leverantörs-API som levererar filer i CSV- och XML-format. Dessa format passar produktkataloger eftersom flera produkter kan överföras samtidigt och sedan omvandlas till min egen datamodell.

Algolia används för produktsökning. Min backend kommunicerar med söktjänsten och returnerar resultatet i ett format som passar webbshoppen. Det gör att sökningen kan vidareutvecklas utan att frontend behöver känna till alla detaljer om Algolia.

Stripe kombinerar API-anrop, redirect och webhooks. Express skapar betalningssessionen, kunden genomför betalningen hos Stripe och Stripe skickar därefter en webhook. Webhooken är viktig eftersom betalningsstatus inte ska bestämmas av vad webbläsaren visar.

Supabase används via API för databasåtkomst och lagring av produktbilder. Bilderna ligger i molnlagring medan produktinformationen innehåller referenser till dem.

## 2. Varför externa anrop går via Express

Jag använder Express som mellanlager mellan React och externa tjänster.

Den största anledningen är säkerhet. Hemliga API-nycklar ska finnas på servern och aldrig exponeras i webbläsaren.

Backend kan också validera inkommande data, kontrollera behörigheter och hantera fel innan information skickas vidare.

Vid betalningar är detta särskilt viktigt. Kunden ska exempelvis inte kunna ändra en produkts pris genom att manipulera informationen som skickas från frontend.

En annan fördel är att jag kan byta extern leverantör utan att behöva bygga om hela användargränssnittet.

## 3. Varför jag använder externa tjänster

Jag valde att integrera befintliga tjänster eftersom de löser komplexa problem som annars skulle kräva mycket utveckling och underhåll.

Att bygga en egen sökmotor med stavfelstolerans och effektiv indexering skulle vara betydligt mer komplicerat än att använda Algolia.

Stripe hanterar betalningsinfrastruktur och kortbetalningar. Att utveckla motsvarande lösning själv skulle innebära stora krav på säkerhet, regelefterlevnad och drift.

Supabase förenklar både databasåtkomst och lagring av bilder. Jag behöver inte utveckla ett eget lagringssystem med filhantering och publika bildadresser.

Leverantörsintegrationen gör att jag kan importera produktkataloger automatiskt i stället för att registrera produkterna manuellt.

## 4. Vad händer om en extern tjänst inte fungerar?

Beroendet av externa tjänster innebär att vissa funktioner kan påverkas av driftstörningar.

Om leverantörens API inte svarar kan nya produkter inte importeras, men de produkter som redan finns i databasen kan fortfarande användas.

Om Algolia är otillgängligt påverkas produktsökningen. Webbshoppen behöver då visa ett begripligt felmeddelande i stället för att krascha.

Om Stripe inte svarar ska kunden inte få en felaktig betalningsbekräftelse. Ordern ska förbli obetald tills en verifierad betalning har registrerats.

Om Supabase Storage inte fungerar kan bilduppladdningar misslyckas. En befintlig produktbild bör behållas om en ny uppladdning inte lyckas.

Dessa situationer visar varför felhantering, timeout och tydlig återkoppling är viktiga delar av integrationsarbetet.

## 5. Risker med externa beroenden

Externa tjänster innebär både tekniska och ekonomiska risker.

En leverantör kan ändra sina priser, begränsningar eller API-villkor. En gratis tjänst kan exempelvis bli dyrare när webbshoppen får fler användare.

Det finns också en risk att API:er förändras och att integrationen måste uppdateras.

Personuppgifter behöver hanteras med hänsyn till GDPR. Vid betalningar är det särskilt viktigt att bara behandla den information som faktiskt behövs och att undvika att lagra känsliga kortuppgifter i den egna applikationen.

Jag minskar beroendet genom att samla integrationslogiken i backend och hålla externa tjänsters detaljer separerade från användargränssnittet.

## Slutsats

Arbetet med Shopy Shop har gett mig större förståelse för hur externa system samverkar i en modern webbapplikation.

Den viktigaste erfarenheten är att en integration inte bara handlar om att skicka och ta emot data. Den måste även vara säker, validera information, hantera fel och fungera korrekt när samma händelse inträffar flera gånger.

Stripe-integrationen är ett tydligt exempel, eftersom en lyckad betalning måste påverka både orderstatus och lagersaldo på ett kontrollerat sätt.

Projektet har också visat värdet av att bygga en backend som fungerar som ett gemensamt gränssnitt mellan frontend, databasen och externa tjänster.

---

## Status inför inlämning

| Del                       | Status                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| Labb 1 – CSV/XML-import   | Implementerad                                                                |
| Labb 2 – Algolia          | Implementerad                                                                |
| Labb 3 – Stripe           | Implementerad och lokalt testad; utgångna orderstatusar behöver kontrolleras |
| Labb 4 – Supabase Storage | Implementerad via Express med JPEG-stöd                                      |
| Labb 5 – Frakt            | Serverbaserad mock implementerad                                             |
| Deployment                | Driftsatt                                                                    |
| README och reflektion     | Uppdaterade                                                                  |

## Författare

**Nahid Baninamrah**

Systemutvecklare – Medieinstitutet

## Utbildningsuppgift

**Inlämningsuppgift 1 – Integrera shoppen med omvärlden**

Inlämningsdatum: oktober 2026
https://shopy-shop-gamma.vercel.app/






## Inlämningsuppgift 2 – Konton och autentisering

Kunder loggar in med Google (OAuth 2.0 + OpenID Connect) och shoppen skickar en orderbekräftelse via e-post med Resend när en order är betald. Hela inloggningen går via backend (Express på Vercel). Client secrets och API-nycklar finns bara som miljövariabler på servern (`.env` lokalt, Vercels Environment Variables i produktion) och når aldrig webbläsaren. Den deployade shoppen: https://shopy-shop-gamma.vercel.app

### 1. Inloggningsflödet (Google)

1. Kunden klickar på **Fortsätt med Google** på `/login`. Webbläsaren går till `GET /api/auth/google` på vår server.
2. Servern skapar ett slumpmässigt `state` (32 slumpbytes, base64url) och sparar det i en `httpOnly`-cookie (`google_oauth_state`, 10 minuter, `secure` i produktion, `SameSite=Lax`). Servern skickar sedan kunden vidare till Google med `scope=openid email profile` (minsta möjliga scope) och samma `state`.
3. Kunden loggar in hos Google och godkänner. Google skickar tillbaka kunden till `GET /api/auth/google/callback?code=…&state=…`.
4. Servern jämför `state` i adressen med `state` i cookien (med `timingSafeEqual`) och raderar cookien direkt. Stämmer de inte överens, eller om kunden avbröt (`error` i adressen), avvisas inloggningen och kunden skickas till `/login` med ett begripligt felmeddelande.
5. Servern byter `code` mot tokens hos Googles token-endpoint. Det sker på servern, med vår client secret, och med timeout på 5 sekunder.
6. Servern läser kunden ur Googles **ID-token** (en JWT) och verifierar den med `jose` mot Googles publika nycklar (JWKS): signaturen (RS256), utfärdaren `iss` (Google), mottagaren `aud` (vårt client ID) och utgångstiden `exp`. Uppgifterna valideras sedan med Zod (`sub`, `email`, `email_verified`, `name`). En overifierad e-postadress avvisas.
7. Servern letar upp kunden i tabellen `customers` via Googles **`sub`**, inte via e-postadressen, eftersom `sub` är stabilt och en e-postadress kan ändras. Finns ingen kund skapas en ny vid första inloggningen (`google_sub`, e-post, namn). Nästa gång hittas samma kund och ingen ny skapas (`google_sub` är `UNIQUE` i databasen).
8. Servern skapar shoppens egen session (se avsnitt 3), sätter den i en cookie och skickar kunden till Mina sidor (`/my-account`).

**Vad `state` skyddar mot.** `state` skyddar mot CSRF mot inloggningen ("login CSRF"). Utan `state` kan en angripare lura en kund att öppna en callback-adress med angriparens egen `code`, så att kunden loggas in på angriparens konto. Med `state` fungerar bara en callback som hör ihop med en inloggning som just den webbläsaren startade, eftersom värdet måste matcha cookien.

**Varför bara `state` och inte PKCE.** Jag valde `state`. PKCE skyddar mot att en stulen `code` används av någon annan. Shoppen är en *confidential client*: koden byts på servern och kräver vår client secret, som aldrig lämnar servern. En stulen `code` är därför värdelös utan secret. PKCE hade gett ett extra lager (försvar i flera led) och skulle vara ett måste för en ren webbläsarapp eller mobilapp utan hemlighet, men kravet är `state` och/eller PKCE och `state` räcker för vår serverbaserade lösning.

**Redan befintlig inloggning med lösenord.** Adminernas inloggning med e-post och lösenord finns kvar (Supabase Auth, en separat tabell). Google är ett andra sätt att logga in, för kunder. Konton slås **inte** ihop på e-postadressen: kunder identifieras bara med `google_sub`, så en kund aldrig kan ta över ett annat konto bara genom att ha samma e-postadress. E-post är därför inte unik i `customers`.

### 2. Tokens

| Token | Varifrån | Används till | Sparas | Livslängd |
|---|---|---|---|---|
| Authorization code | Google, i callback-adressen | Byts mot tokens, direkt | Sparas inte | Kort och kan användas en gång |
| Googles ID-token (JWT) | Google, vid kodbytet | Läsa vem kunden är (`sub`, e-post, namn) | Sparas inte, kastas efter verifieringen | Cirka 1 timme (`exp`) |
| Googles access token | Google, vid kodbytet | Används inte, eftersom allt vi behöver finns i ID-token | Sparas inte | Kort |
| Shoppens sessions-JWT | Vår server | Visa att kunden är inloggad | `httpOnly`-cookie `customer_session` | 7 dagar |
| `state` | Vår server | Skydda inloggningen | `httpOnly`-cookie, raderas i callbacken | 10 minuter |

Googles tokens når aldrig webbläsaren eller React. Webbläsaren får bara shoppens egen session-cookie, som JavaScript inte kan läsa (`httpOnly`).

### 3. Session eller JWT

Jag valde **JWT i en `httpOnly`-cookie**. Efter inloggningen signerar servern en JWT (HS256, `CUSTOMER_SESSION_SECRET`, utfärdare `priamos-shop`, mottagare `customer`, `sub` = kundens id i databasen, giltig i 7 dagar). Cookien är `httpOnly`, `secure` i produktion och `SameSite=None` i produktion (annars `Lax`). Servern kontrollerar signatur, utfärdare, mottagare och utgångstid vid varje anrop.

Varför JWT: Backend körs som serverless-funktioner på Vercel, utan delat minne mellan anrop. En klassisk session kräver en sessionstabell eller Redis, och en databasuppslagning per anrop. En JWT är tillståndslös, och servern behöver bara hemligheten för att kontrollera den.

Nackdelen och riskerna, och vad jag gör åt dem:
- **Stulen token.** En JWT kan inte återkallas enskilt före `exp`. Den som stjäl cookien kan agera som kunden i upp till 7 dagar. Att cookien är `httpOnly` gör den svår att stjäla med XSS, och `secure` hindrar att den skickas över ofrisk anslutning. Nödbromsen är att byta `CUSTOMER_SESSION_SECRET`, vilket ogiltigförklarar alla sessioner och loggar ut alla kunder.
- **Kortare livslängd** minskar risken ytterligare, till priset av oftare inloggning.
- **När en server-session passar bättre:** när man måste kunna spärra en enskild session direkt, till exempel för administratörer eller känsliga system. Då lagrar man sessionen i databasen och raderar raden vid utloggning eller misstanke om stöld. För en kund som bara ser sina egna beställningar väger bekvämligheten med JWT tyngre.
- Utloggning raderar cookien (`POST /api/auth/logout`).

### 4. Mina sidor

Skyddade routes under `/api/customers` kräver en giltig kundsession och svarar **401** utan inloggning. Servern hämtar kundens id ur sessions-JWT, aldrig ur något webbläsaren skickar, så en kund ser bara sina egna ordrar. En order som läggs när kunden är inloggad kopplas till kundkontot (`orders.customer_id`) genom `optionalCustomer`-middlewaren i checkouten. Gäster kan fortfarande handla utan konto.

### 5. Orderbekräftelse via e-post (Resend)

- **Adapter.** Bara en fil, `integrations/emailAdapter.js`, känner till Resends adress och API-nyckel (`RESEND_API_KEY`, `EMAIL_FROM`, båda som miljövariabler). Anropet har timeout på 8 sekunder, och Resends svar valideras med Zod innan det används.
- **När den skickas.** I Stripe-webhooken (`checkout.session.completed`), efter att ordern har markerats som betald, aldrig när kunden klickar på "Köp".
- **Innehåll.** Ordernummer i ämnesraden. I mejlet finns kundens namn, produkterna med antal och pris, frakt och totalsumma, både som `html` och `text`. Kundens uppgifter (namn, produktnamn) escapas innan de hamnar i HTML:en.
- **En bekräftelse per order.** Varje utskick har headern `Idempotency-Key: order-confirmation/<orderns id>`. Om Stripe skickar samma webhook flera gånger skickar Resend ändå bara ett mejl.
- **Fel stoppar inte ordern.** Mejlfunktionen kastar aldrig. Misslyckas utskicket (fel nyckel, timeout, fel från Resend) loggas felet i serverns logg, ordern är redan betald och webhooken svarar inte 500 på grund av mejlet.
- **Testning.** Utan egen domän skickar jag från `onboarding@resend.dev`, som bara kan leverera till e-postadressen på mitt Resend-konto. Jag testade därför med den adressen.

### 6. Timeouts och validering

Alla externa anrop har timeout: Googles token-endpoint och JWKS (5 s), Supabase (5 s) och Resend (8 s). Svar från Google, Supabase och Resend valideras med Zod innan de används. Fel ger ett begripligt meddelande i stället för en kraschad sida.

### 7. environment variables

Lokalt i `.env` (finns i `.gitignore`), i produktion i Vercels Environment Variables. Exempel finns i `.env.example` utan riktiga värden: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `CUSTOMER_SESSION_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.