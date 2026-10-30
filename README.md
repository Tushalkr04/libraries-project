# Libraries

A small library-management mini project with a browser dashboard, a Node.js API, and Oracle PL/SQL procedures. Books, members, and checkouts are stored in Oracle Database XE; issue and return operations update inventory through the `LIBRARIES_API` PL/SQL package.

## Requirements

- Node.js 18 or newer
- Oracle Database XE with the listener running
- SQL*Plus (included with Oracle XE)

The default connection string is `localhost:1521/XEPDB1`, the pluggable database service exposed by this Oracle XE installation. Change it in `.env` if your database uses a different host, port, or service name.

## Run this workspace

This workspace is already configured for the local Oracle XE `XEPDB1` service. Its dedicated `LIBRARIES_APP` account and schema are installed, and the connection settings are saved in the ignored `.env` file.

Use the **Libraries** shortcut on your Desktop to start the app and open it in your browser. The shortcut reuses the app if it is already running. It waits for the Oracle API to become ready before opening the page.

To start it from PowerShell instead:

```powershell
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The demo books, members, and active checkouts can be (re)loaded safely without duplicating existing sample records:

```powershell
sqlplus LIBRARIES_APP@localhost:1521/XEPDB1
```

After signing in, run:

```sql
@database\03_seed_demo_data.sql
```

## Set up another Oracle database

Use the following steps only when installing this project against a fresh database.

### 1. Create the application database user

Open PowerShell in this project folder and run:

```powershell
sqlplus / as sysdba
```

At the SQL*Plus prompt, run the setup script:

```sql
@database\01_create_user.sql
```

Enter a password when prompted, then exit SQL*Plus:

```sql
EXIT
```

The script creates a dedicated `LIBRARIES_APP` account with the session, table, sequence, and PL/SQL procedure privileges needed by this project.

### 2. Create the tables and PL/SQL package

Run the schema script using the password you just chose:

```powershell
sqlplus LIBRARIES_APP@localhost:1521/XEPDB1
```

At the password prompt, enter the application password and then run:

```sql
@database\02_schema.sql
```

The script creates the books, members, and loans tables, plus PL/SQL procedures for adding books and members, checking books out, and returning them.

### 3. Configure and run the app

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set `DB_PASSWORD` to the application password. Install packages and start the app:

```powershell
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Add books and members, check books out, and record returns from the dashboard.

## Project layout

- `public/` — responsive browser interface
- `server/index.js` — Express API using the Oracle Node.js driver
- `database/01_create_user.sql` — dedicated database account setup
- `database/02_schema.sql` — tables and PL/SQL package
- `.env.example` — local connection settings template

The API uses Oracle's Thin mode, so a separate Oracle Instant Client installation is not required. Never commit your local `.env` file.
