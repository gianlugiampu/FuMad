# FuMad — versione Vercel (serverless + Postgres + JWT)

Stessa app (login, due balconi con posti/coda/Privacy/Gossip, cleanup ogni 15 min) riscritta per girare su funzioni serverless Vercel invece di un server Node persistente.

## Cosa e cambiato rispetto alla versione precedente

- **Storage**: da file JSON locali a **Postgres** (compatibile con Supabase, Neon, Vercel Postgres — qualsiasi Postgres va bene, basta la connection string).
- **Sessioni**: da sessione server-side a **JWT stateless** in un cookie httpOnly. Nessuno stato di sessione da condividere tra istanze serverless.
- **Cleanup ogni 15 minuti**: niente `setInterval` (non funziona su serverless). Ogni posto ha il proprio timer individuale: ogni richiesta all'API controlla, posto per posto, se sono passati 15+ minuti da quando è stato occupato e, in caso, lo libera e riassegna dalla coda prima di rispondere. Gli altri posti occupati più di recente non vengono toccati. Nessun cron necessario, funziona anche sul piano gratuito.
- **Privacy**: riserva tutto il balcone solo per te per 2 minuti — richiede che sia completamente libero. Il tuo posto appare azzurro, gli altri bloccati (nessuno può occuparli finché la riserva è attiva). Puoi terminarla in anticipo cliccando sul tuo posto.
- **Gossip**: riserva il balcone per te + colleghi selezionati (dagli utenti registrati, fino a riempire i posti disponibili) per 5 minuti — il balcone deve essere libero, oppure occupato solo da persone che hai selezionato (in quel caso il loro posto normale viene assorbito nella riserva). I posti del gruppo appaiono rosa, gli eventuali posti in eccesso restano bloccati. Solo chi l'ha avviato può terminarla in anticipo.
- **Due balconi**: Balcone #1 (4 posti) e Balcone #2 (2 posti), stessa logica di prenotazione, coda, Privacy e Gossip per entrambi. Un tab in cima alla board fa passare dall'uno all'altro. Se il Balcone #1 è pieno o occupato e premi "Mettiti in coda"/Privacy/Gossip (quest'ultimo solo se il gruppo e' di 2 persone), l'app propone di provare nel Balcone #2 — se rifiuti (o è occupato anche quello) resti in coda sul Balcone #1. Un utente non può però avere un posto o essere in coda su entrambi i balconi contemporaneamente (vale anche per gli invitati a un Gossip).
- **Grafico affollamento**: in fondo alla board, istogramma per fascia oraria (0-23) basato sulla cronologia delle ultime 50 prenotazioni/riserve del balcone corrente — la fascia oraria col picco è evidenziata in rosso. La cronologia viene eliminata dal database (non solo nascosta) a ogni cambio di mese, lazy come il resto del cleanup: succede alla prima richiesta utile del mese nuovo.
- **Tema chiaro/scuro**: interruttore in alto a destra (sfrutta `data-bs-theme` di Bootstrap 5.3), preferenza salvata in `localStorage` del browser.
- **Allerta Caldo**: bottone in fondo alla board, condiviso da tutti gli utenti — chi lo attiva fa comparire uno sfondo arancione a tutti (via polling ogni 5s) con la scritta "{nome} ha attivato allarme caldo" sotto il meteo. Chiunque può disattivarlo ricliccando il bottone.

## Struttura

```
fumad-vercel/
  api/
    register.js   POST - crea utente, hash bcrypt, imposta cookie JWT
    login.js      POST
    logout.js     POST
    me.js         GET  - utente corrente dal cookie
    state.js      GET  - stato board (applica cleanup lazy se necessario)
    book.js       POST - occupa il primo posto libero
    free.js       POST - libera il tuo posto (o termina una prenotazione Privacy/Gossip se sei tu ad averla avviata)
    queue.js      POST - mettiti in coda
    privacy.js    POST - riserva tutto il balcone solo per te, 2 minuti
    gossip.js     POST - riserva il balcone per te + fino a 3 colleghi selezionati, 5 minuti
    users.js      GET  - elenco utenti registrati (esclude te stesso), usato per selezionare chi invitare al Gossip
    heat-alert.js POST - attiva/disattiva l'Allerta Caldo condivisa
  lib/
    db.js          Pool Postgres + creazione schema automatica al primo uso
    auth.js        Firma/verifica JWT, gestione cookie
    board.js       Logica cleanup lazy, assegnazione dalla coda, prenotazioni Privacy/Gossip, capacita per balcone
    rateLimit.js   Limite tentativi per IP su register/login
    globalState.js Stato condiviso non legato a un balcone (Allerta Caldo)
  public/
    index.html    Frontend: login/registrazione + board
```

---

## Parte 1 — Crea il database Postgres

Puoi usare uno qualsiasi di questi, tutti hanno un piano gratuito che basta ampiamente per un ufficio:

- **Supabase** (supabase.com) — probabilmente il piu semplice da usare online.
- **Neon** (neon.tech) — Postgres serverless, ottima integrazione con Vercel.
- **Vercel Postgres / Vercel Storage** — se preferisci restare dentro un solo pannello.

Passi generali (validi per Supabase e Neon):

1. Crea un account e un nuovo progetto.
2. Cerca la **connection string** (di solito nella sezione "Database" o "Connect"), del tipo:
   ```
   postgres://utente:password@host:5432/nomedb
   ```
3. Copiala da parte, ti servira come variabile `DATABASE_URL` su Vercel.

Non serve creare tabelle a mano: il codice le crea da solo al primo avvio (`lib/db.js`, `ensureSchema`).

---

## Parte 2 — Metti il codice su GitHub con l'account diverso

Dato che sul tuo computer hai gia un altro account GitHub collegato, il modo piu pulito per non mischiare le credenziali e usare un **Personal Access Token (PAT)** dell'account nuovo solo per questo push, senza toccare la configurazione git globale.

1. **Accedi a github.com nel browser con l'account che vuoi usare per questo progetto** (usa una finestra in incognito se hai gia l'altro account loggato altrove, per evitare confusione).
2. Crea un nuovo repository vuoto (es. `fumad`), senza README/licenza (repository vuoto).
3. Genera un token: vai su **Settings → Developer settings → Personal access tokens → Tokens (classic)** (sempre loggato con l'account nuovo) → **Generate new token** → seleziona lo scope `repo` → genera e **copia il token** (non lo rivedrai piu).
4. Sul tuo computer, nella cartella del progetto:

```bash
cd fumad-vercel
git init
git add .
git commit -m "FuMad backend per Vercel"
git branch -M main
git remote add origin https://<TUO-USERNAME-NUOVO>:<IL-TOKEN>@github.com/<TUO-USERNAME-NUOVO>/fumad.git
git push -u origin main
```

Usando il token direttamente nell'URL del remote, il push usa quelle credenziali **solo per questo repository**, senza toccare il tuo account git di default o il credential manager del sistema.

5. Dopo il push, e buona norma rimuovere il token dall'URL salvato in locale (per non lasciarlo in chiaro nel file `.git/config`):

```bash
git remote set-url origin https://github.com/<TUO-USERNAME-NUOVO>/fumad.git
```

Da quel momento in poi, un `git push` normale ti chiedera nuovamente le credenziali (o puoi reinserire il token quando richiesto).

---

## Parte 3 — Deploy su Vercel

1. Vai su **vercel.com** e accedi (puoi creare un account Vercel nuovo usando "Continue with GitHub" e scegliendo l'account GitHub nuovo, oppure collegare quell'account GitHub a un account Vercel esistente da Settings → Git).
2. **Add New → Project**, seleziona il repository `fumad` appena creato.
3. Vercel rileva automaticamente che e un progetto Node con cartella `api/` (funzioni serverless) e `public/` (statico) — non serve configurare nulla di speciale nel build.
4. Prima di premere "Deploy", apri **Environment Variables** e aggiungi:

| Nome | Valore |
|---|---|
| `DATABASE_URL` | la connection string copiata nella Parte 1 |
| `JWT_SECRET` | una stringa lunga e casuale (genera con `openssl rand -hex 32` sul tuo computer, o un generatore di password online) |
| `COOKIE_SECURE` | `true` |
| `REGISTER_INVITE_CODE` | (opzionale) una parola/frase da condividere solo con chi deve potersi registrare — se impostata, la registrazione richiede questo codice; se lasciata vuota/non impostata, la registrazione resta aperta a chiunque trovi l'URL |

5. Premi **Deploy**. Dopo un minuto avrai un URL tipo `https://fumad-tuonome.vercel.app`.
6. Apri l'URL, registra il primo utente e prova a prenotare un posto.

## Note di sicurezza

- **Registrazione**: se hai impostato `REGISTER_INVITE_CODE`, condividi quel codice solo con le persone che devono potersi registrare (es. i colleghi d'ufficio) — chiunque altro trovi l'URL non potrà creare un account.
- **Rate limiting**: `/api/register` e `/api/login` sono limitati a 10 tentativi ogni 15 minuti per indirizzo IP, per rallentare bot e tentativi di forza bruta.

---

## Note e limiti da sapere

- **Piano gratuito Postgres**: sia Supabase che Neon hanno limiti generosi ma finiti (storage, ore di calcolo). Per un piccolo ufficio non li avvicinerai nemmeno.
- **Cleanup ogni 15 minuti**: essendo "lazy" (attivato dalla prima richiesta utile dopo i 15 minuti), se nessuno apre la pagina per ore il cleanup semplicemente non scatta finche qualcuno non fa una richiesta — cosa che comunque non ha impatto pratico, perche il cleanup serve solo a liberare posti stantii, e se non c'e traffico non c'e neanche nessuno in attesa.
- **JWT_SECRET**: se lo cambi in futuro, tutte le sessioni attive vengono invalidate (tutti dovranno rifare login) — normale e atteso.
- **Aggiornare il sito in futuro**: basta fare `git push` sul branch `main` — Vercel ridispone automaticamente ad ogni push.
