# FuMad — versione Vercel (serverless + Postgres + JWT)

Stessa app (login, board 4 posti, coda, cronologia, cleanup ogni 15 min) riscritta per girare su funzioni serverless Vercel invece di un server Node persistente.

## Cosa e cambiato rispetto alla versione precedente

- **Storage**: da file JSON locali a **Postgres** (compatibile con Supabase, Neon, Vercel Postgres — qualsiasi Postgres va bene, basta la connection string).
- **Sessioni**: da sessione server-side a **JWT stateless** in un cookie httpOnly. Nessuno stato di sessione da condividere tra istanze serverless.
- **Cleanup ogni 15 minuti**: niente `setInterval` (non funziona su serverless). Ogni richiesta all'API controlla se sono passati 15+ minuti dall'ultimo cleanup e, in caso, libera i posti e riassegna dalla coda prima di rispondere. Nessun cron necessario, funziona anche sul piano gratuito.

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
    free.js       POST - libera il tuo posto
    queue.js      POST - mettiti in coda
  lib/
    db.js         Pool Postgres + creazione schema automatica al primo uso
    auth.js       Firma/verifica JWT, gestione cookie
    board.js      Logica cleanup lazy + assegnazione dalla coda
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

5. Premi **Deploy**. Dopo un minuto avrai un URL tipo `https://fumad-tuonome.vercel.app`.
6. Apri l'URL, registra il primo utente e prova a prenotare un posto.

---

## Note e limiti da sapere

- **Piano gratuito Postgres**: sia Supabase che Neon hanno limiti generosi ma finiti (storage, ore di calcolo). Per un piccolo ufficio non li avvicinerai nemmeno.
- **Cleanup ogni 15 minuti**: essendo "lazy" (attivato dalla prima richiesta utile dopo i 15 minuti), se nessuno apre la pagina per ore il cleanup semplicemente non scatta finche qualcuno non fa una richiesta — cosa che comunque non ha impatto pratico, perche il cleanup serve solo a liberare posti stantii, e se non c'e traffico non c'e neanche nessuno in attesa.
- **JWT_SECRET**: se lo cambi in futuro, tutte le sessioni attive vengono invalidate (tutti dovranno rifare login) — normale e atteso.
- **Aggiornare il sito in futuro**: basta fare `git push` sul branch `main` — Vercel ridispone automaticamente ad ogni push.
