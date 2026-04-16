# Arista Testcase Management (ATM)

## Quick Start

### 1. Start the database
```bash
docker compose up -d
```
- PostgreSQL runs on `localhost:5432`
- pgAdmin UI at http://localhost:5050 (email: `admin@atm.local`, password: `admin`)
- DB schema migrations run automatically when the backend starts.

### 2. Start the backend
```bash
cd backend
npm install        # first time only
npm run dev        # or: npm start
```
Backend API: http://localhost:3001/api/health

### 3. Start the frontend
```bash
cd frontend
npm install        # first time only
npm run dev
```
Frontend: http://localhost:5173

---

## Project Structure

```
ATM/
├── docker-compose.yml       # postgres + pgadmin
├── backend/
│   ├── src/
│   │   ├── index.js         # Express entry; runs migrations on start
│   │   ├── db.js            # pg pool + migration runner
│   │   ├── routes/          # folders, testcases, runs
│   │   ├── controllers/     # folderController, testcaseController, runController
│   │   └── middleware/      # errorHandler
│   ├── migrations/
│   │   └── 001_init.sql     # full DB schema
│   └── .env                 # DATABASE_URL, PORT
└── frontend/
    └── src/
        ├── schemas/          # velocloudSchema.js, aristaSchema.js
        ├── stores/           # Zustand stores
        ├── api/              # axios wrappers
        └── components/
            ├── layout/       # TopBar, TCSection, RunsSection, UserPrompt
            ├── folder/       # FolderTree (recursive)
            ├── testcase/     # TCList, TCDetail, TCForm, DynamicField
            ├── import/       # ExcelImport modal
            └── testrun/      # RunFolderTree, RunItemList, AddTCModal, ReportView
```

## Key Features
- **VeloCloud & Arista tabs** — dynamic field rendering per section schema
- **Folder hierarchy** — create/delete nested folders per section
- **Excel import** — auto-maps columns, manual override mapping
- **Global search** — exact TC ID → single view, string → filtered list
- **Version history** — every save writes a snapshot to `testcase_history`
- **Admin mode** — toggle in top bar; hides Edit/Import/Delete when off
- **Test Runs** — release → feature hierarchy, mark pass/fail, generate reports
