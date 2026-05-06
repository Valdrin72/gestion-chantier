# ===============================================================
# Archi Platform - Script d'installation Windows
# Lance ce script depuis le dossier archi-platform/ avec PowerShell :
#   .\setup.ps1
# ===============================================================

$ErrorActionPreference = "Stop"

function Write-Title($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK($msg)    { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "  [!]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "  [X]  $msg" -ForegroundColor Red }

# ----- 1. Verifications prerequis -----
Write-Title "Verification des prerequis"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Err "Node.js n'est pas installe. Installe-le depuis https://nodejs.org/ (LTS) puis relance."
  exit 1
}
$nodeVer = (node --version)
Write-OK "Node.js detecte : $nodeVer"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Err "npm introuvable (devrait venir avec Node.js)."
  exit 1
}

# Trouver psql (peut etre dans le PATH ou dans Program Files)
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue
  if ($candidates) {
    $psqlPath = $candidates | Sort-Object FullName -Descending | Select-Object -First 1
    $env:PATH += ";$($psqlPath.DirectoryName)"
    Write-OK "psql ajoute au PATH pour cette session : $($psqlPath.DirectoryName)"
  } else {
    Write-Err "PostgreSQL n'est pas installe."
    Write-Host ""
    Write-Host "  Telecharge l'installeur officiel : https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "  Pendant l'installation, NOTE LE MOT DE PASSE du user 'postgres'." -ForegroundColor Yellow
    Write-Host "  Puis relance ce script." -ForegroundColor Yellow
    exit 1
  }
}
$psqlVer = (psql --version)
Write-OK "PostgreSQL detecte : $psqlVer"

# ----- 2. Mot de passe PostgreSQL -----
Write-Title "Connexion PostgreSQL"
Write-Host "Le user 'postgres' a ete cree pendant l'installation de PostgreSQL." -ForegroundColor Gray
$pgPassword = Read-Host "Mot de passe du user 'postgres' (saisie cachee)" -AsSecureString
$pgPasswordPlain = [System.Net.NetworkCredential]::new("", $pgPassword).Password

$env:PGPASSWORD = $pgPasswordPlain
$null = & psql -U postgres -h localhost -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Err "Impossible de se connecter avec ce mot de passe. Re-essaie."
  exit 1
}
Write-OK "Connexion PostgreSQL reussie"

# ----- 3. Creation base + user dedies -----
Write-Title "Creation de la base de donnees"
$dbName = "archi_platform"
$dbUser = "archi"
$dbPass = "archi_local_$(Get-Random -Minimum 1000 -Maximum 9999)"

# user
& psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='$dbUser'" | Out-Null
if ($LASTEXITCODE -eq 0) {
  $exists = & psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='$dbUser'"
  if ($exists -eq "1") {
    & psql -U postgres -h localhost -c "ALTER USER $dbUser WITH PASSWORD '$dbPass' SUPERUSER;" | Out-Null
    Write-OK "User '$dbUser' existe deja, mot de passe mis a jour"
  } else {
    & psql -U postgres -h localhost -c "CREATE USER $dbUser WITH PASSWORD '$dbPass' SUPERUSER;" | Out-Null
    Write-OK "User '$dbUser' cree"
  }
}

# database
$dbExists = & psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
if ($dbExists -eq "1") {
  Write-OK "Base '$dbName' existe deja"
} else {
  & psql -U postgres -h localhost -c "CREATE DATABASE $dbName OWNER $dbUser;" | Out-Null
  Write-OK "Base '$dbName' creee"
}

Remove-Item Env:PGPASSWORD

# ----- 4. Generation AUTH_SECRET -----
Write-Title "Configuration"
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$authSecret = [Convert]::ToBase64String($bytes)

# ----- 5. Ecriture .env -----
$envContent = @"
DATABASE_URL="postgresql://${dbUser}:${dbPass}@localhost:5432/${dbName}?schema=public"
AUTH_SECRET="${authSecret}"
AUTH_URL="http://localhost:3001"

STORAGE_DRIVER="local"
STORAGE_LOCAL_PATH="./storage/local"

EMAIL_DRIVER="console"
EMAIL_FROM="Archi Platform <noreply@example.com>"

APP_URL="http://localhost:3001"
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
Write-OK "Fichier .env genere"

# ----- 6. Install deps -----
Write-Title "Installation des dependances (peut prendre 1-2 minutes)"
& npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Err "npm install a echoue. Relance manuellement : npm install --legacy-peer-deps"
  exit 1
}
Write-OK "Dependances installees"

# ----- 7. Schema DB -----
Write-Title "Creation des tables"
& npx prisma db push --skip-generate 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Err "prisma db push a echoue."
  exit 1
}
& npx prisma generate 2>&1 | Out-Null
Write-OK "Tables creees"

# ----- 8. Seed -----
Write-Title "Donnees de demonstration"
& npm run db:seed 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Err "Seed a echoue."
  exit 1
}
Write-OK "Compte demo + catalogue d'elements crees"

# ----- 9. Final -----
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " INSTALLATION TERMINEE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pour lancer la plateforme :" -ForegroundColor Cyan
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Puis ouvre :" -ForegroundColor Cyan
Write-Host "  http://localhost:3001"
Write-Host ""
Write-Host "Identifiants demo :" -ForegroundColor Cyan
Write-Host "  Email    : demo@archi.test"
Write-Host "  Password : password123"
Write-Host ""
