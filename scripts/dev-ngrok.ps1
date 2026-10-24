<#
.SYNOPSIS
    HUB DIGI - env de test local derriere ngrok (plan Free).

.DESCRIPTION
    ngrok Free n'accorde qu'UN domaine par compte : impossible d'exposer l'API
    et le SPA sur deux tunnels distincts. On expose donc UN SEUL tunnel (Vite,
    port 5199) et Vite relaie le backend Django via server.proxy (voir
    frontend/vite.config.js). SPA et API partagent la meme origine -> plus de
    CORS ni de CSRF, et une seule URL publique a partager.

    Le script :
      1. lit l'authtoken dans la config ngrok globale
      2. demarre le tunnel ngrok (config generee dans %TEMP%, sans secret dans le depot)
      3. lit l'URL publique via l'API locale (http://127.0.0.1:4040/api/tunnels)
      4. reecrit backend/.env + frontend/.env en consequence
      5. (re)demarre Django (8000) puis Vite (5199)

    L'URL publique change a chaque execution : le script la reinjecte partout.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\dev-ngrok.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\dev-ngrok.ps1 -Stop
#>
[CmdletBinding()]
param(
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$Root     = Split-Path -Parent $PSScriptRoot
$Backend  = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$NgrokWeb = 'http://127.0.0.1:4040'

# ---------------------------------------------------------------- helpers ----
function Write-Step([string]$m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m)   { Write-Host "    [ok] $m" -ForegroundColor Green }

function Get-Authtoken {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'),
        (Join-Path $env:USERPROFILE '.config\ngrok\ngrok.yml'),
        (Join-Path $env:APPDATA 'ngrok\ngrok.yml')
    )
    $pack = Join-Path $env:LOCALAPPDATA 'Packages'
    if (Test-Path -LiteralPath $pack) {
        $candidates += (Get-ChildItem -LiteralPath $pack -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like 'ngrok.ngrok_*' } |
            ForEach-Object { Join-Path $_.FullName 'LocalCache\Local\ngrok\ngrok.yml' })
    }
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) {
            $m = [regex]::Match([System.IO.File]::ReadAllText($c), 'authtoken:\s*(\S+)')
            if ($m.Success) { return $m.Groups[1].Value }
        }
    }
    if ($env:NGROK_AUTHTOKEN) { return $env:NGROK_AUTHTOKEN }
    return $null
}

function Set-EnvFile([string]$Path, [hashtable]$Values) {
    $lines = [System.Collections.Generic.List[string]]::new()
    if (Test-Path -LiteralPath $Path) {
        foreach ($l in [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)) { [void]$lines.Add($l) }
    }
    foreach ($k in $Values.Keys) {
        $entry = "$k=$($Values[$k])"
        $idx = -1
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$([regex]::Escape($k))\s*=") { $idx = $i; break }
        }
        if ($idx -ge 0) { $lines[$idx] = $entry } else { [void]$lines.Add($entry) }
    }
    [System.IO.File]::WriteAllLines($Path, $lines, (New-Object System.Text.UTF8Encoding $false))
}

# Bandeau d'alerte en tete du .env : le fichier est reecrit pour le dev/tunnel.
function Set-EnvBanner([string]$Path, [string]$Banner) {
    $lines = [System.Collections.Generic.List[string]]::new()
    [void]$lines.Add($Banner)
    if (Test-Path -LiteralPath $Path) {
        foreach ($l in [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)) { [void]$lines.Add($l) }
    }
    [System.IO.File]::WriteAllLines($Path, $lines, (New-Object System.Text.UTF8Encoding $false))
}

function Test-PortBusy([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Stop-Node {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*vite*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Stop-Django {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*manage.py*runserver*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# ------------------------------------------------------------------- stop ----
if ($Stop) {
    Write-Step 'Arret de l env de dev'
    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
    Stop-Node
    Stop-Django
    Write-Ok 'Tunnels ngrok, Vite et Django arretes.'
    exit 0
}

# ------------------------------------------------------------- preflight ----
Write-Step 'Verification des prerequis'
if (-not (Get-Command ngrok  -ErrorAction SilentlyContinue)) { throw 'ngrok introuvable dans le PATH.' }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'python introuvable dans le PATH.' }
if (-not (Get-Command npm    -ErrorAction SilentlyContinue)) { throw 'npm introuvable dans le PATH.' }

$token = Get-Authtoken
if (-not $token) {
    throw "Authtoken ngrok introuvable. Lance : ngrok config add-authtoken <TOKEN> (token sur https://dashboard.ngrok.com/get-started/your-authtoken)"
}
Write-Ok 'ngrok + python + npm OK (authtoken trouve)'

# arret des tunnels precedents (libere le port 4040)
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800

# sauvegarde des valeurs PROD (une seule fois)
$EnvBackend = Join-Path $Backend '.env'
$EnvBackup  = Join-Path $Backend '.env.prod.bak'
if ((Test-Path -LiteralPath $EnvBackend) -and -not (Test-Path -LiteralPath $EnvBackup)) {
    Copy-Item -LiteralPath $EnvBackend -Destination $EnvBackup
    Write-Ok 'Sauvegarde PROD : backend\.env.prod.bak'
}

# ------------------------------------------------- config ngrok (temporaire) --
# Generee dans %TEMP% : l'authtoken ne doit jamais atterrir dans le depot.
$NgrokCfg = Join-Path $env:TEMP 'hub-digi-ngrok.yml'
$yaml = @"
version: "3"
agent:
    authtoken: $token
    web_addr: 127.0.0.1:4040
tunnels:
    web:
        proto: http
        addr: 5199
        inspect: true
"@
[System.IO.File]::WriteAllText($NgrokCfg, $yaml, (New-Object System.Text.UTF8Encoding $false))

# ------------------------------------------------------ demarrage du tunnel --
Write-Step 'Demarrage du tunnel ngrok (Vite :5199 -> URL publique)'
$logDir = Join-Path $env:TEMP 'ngrok-hub'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$cmdNgrok = 'ngrok start --config "' + $NgrokCfg + '" --all > "' + (Join-Path $logDir 'ngrok.out') + '" 2>&1'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdNgrok -WorkingDirectory $logDir

$publicUrl = $null
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 900
    try {
        $t = (Invoke-RestMethod -Uri "$NgrokWeb/api/tunnels" -TimeoutSec 4).tunnels |
             Where-Object { $_.public_url -like 'https://*' }
        if ($t) { $publicUrl = $t[0].public_url; break }
    } catch { }
}
if (-not $publicUrl) {
    Write-Host (Get-Content (Join-Path $logDir 'ngrok.out') -Raw -ErrorAction SilentlyContinue)
    throw "Tunnel ngrok non demarre. Voir $logDir\ngrok.out"
}
$host_ = ([uri]$publicUrl).Host
Write-Ok "URL publique : $publicUrl"

# ------------------------------------------------------ reecriture des .env --
Write-Step 'Reecriture des .env'

# Une seule origine : le SPA et l'API sont servis par le meme tunnel.
# Backend SMTP si un vrai mot de passe est configure, console sinon (dev).
$emailBackend = 'django.core.mail.backends.console.EmailBackend'
$lignesEnv = [System.IO.File]::ReadAllLines($EnvBackend, [System.Text.Encoding]::UTF8)
$mdpLigne = $lignesEnv | Where-Object { $_ -match '^\s*EMAIL_HOST_PASSWORD\s*=' } | Select-Object -First 1
if ($mdpLigne) {
    $mdp = ($mdpLigne -replace '^\s*EMAIL_HOST_PASSWORD\s*=', '').Trim()
    if ($mdp -and $mdp -notmatch '(?i)change-me|mot-de-passe|changeme|placeholder') {
        $emailBackend = 'django.core.mail.backends.smtp.EmailBackend'
        Write-Ok "SMTP actif (EMAIL_HOST_PASSWORD renseigne)."
    }
}

Set-EnvFile $EnvBackend @{
    'DJANGO_DEBUG'           = '1'
    'DJANGO_ALLOWED_HOSTS'   = "localhost,127.0.0.1,$host_"
    'CORS_ALLOWED_ORIGINS'   = "http://localhost:5199,http://127.0.0.1:5199,https://$host_"
    'CSRF_TRUSTED_ORIGINS'   = "https://$host_"
    'FRONTEND_URL'           = "https://$host_"
    'LIGDICASH_STORE_URL'    = "https://$host_"
    'LIGDICASH_CALLBACK_URL' = "https://$host_/api/v1/finance/paiements/ligdicash/callback/"
    'PAYMENT_ENABLED'        = '1'
    'LIGDICASH_ENABLED'      = '1'
    'EMAIL_BACKEND'          = $emailBackend
}
Write-Ok 'backend\.env  (DEBUG=1, callback + FRONTEND_URL -> tunnel)'

# Bandeau : ce .env est celui du dev, pas celui du VPS.
$banner = '# !!! DEV/TUNNEL - regenere par scripts/dev-ngrok.ps1 - NE PAS COPIER SUR LE VPS !!!'
$envLines = [System.IO.File]::ReadAllLines($EnvBackend, [System.Text.Encoding]::UTF8)
$filtered = @($envLines | Where-Object { $_ -notmatch '^# !!! DEV/TUNNEL' })
[System.IO.File]::WriteAllLines($EnvBackend, (@($banner) + $filtered), (New-Object System.Text.UTF8Encoding $false))

Set-EnvFile (Join-Path $Frontend '.env') @{
    'VITE_API_URL'        = '/api/v1'
    'VITE_PAIEMENT_ACTIF' = 'true'
}
Write-Ok 'frontend\.env (API relative /api/v1 -> proxy Vite, paiement actif)'

# --------------------------------------------------------- serveurs de dev ---
Write-Step 'Demarrage Django + Vite'
Stop-Node
Stop-Django
Start-Sleep -Seconds 1

Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'python manage.py migrate --noinput && python manage.py runserver 8000' -WorkingDirectory $Backend
Write-Ok 'Django runserver (8000)'

Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev' -WorkingDirectory $Frontend
Write-Ok 'Vite dev (5199)'

$deadline = (Get-Date).AddSeconds(60)
$ok = $false
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if ((Test-PortBusy 8000) -and (Test-PortBusy 5199)) { $ok = $true; break }
}
if ($ok) { Write-Ok 'Ports 8000 et 5199 en ecoute.' }
else { Write-Warning 'Un port ne repond pas. Regarde les fenetres cmd ouvertes.' }

# --------------------------------------------------------------- resume -----
Write-Host ''
Write-Host '=========================================================' -ForegroundColor Green
Write-Host '  HUB DIGI - env de test ngrok pret' -ForegroundColor Green
Write-Host '=========================================================' -ForegroundColor Green
Write-Host "  SPA + API (meme origine) : $publicUrl"
Write-Host "  Callback LigdiCash       : $publicUrl/api/v1/finance/paiements/ligdicash/callback/"
Write-Host "  Tableau ngrok            : http://127.0.0.1:4040"
Write-Host ''
Write-Host "  1. Ouvre $publicUrl (ngrok affiche 1 page d'avertissement : clique 'Visit Site')" 
Write-Host "  2. Connecte-toi, ouvre une facture, 'Copier le lien de paiement'"
Write-Host "  3. Ouvre le lien /paiement/facture/<NUM>?sig=... puis 'Payer'"
Write-Host "  4. Verifie le POST du callback sur http://127.0.0.1:4040"
Write-Host ''
Write-Host '  Arret : powershell -ExecutionPolicy Bypass -File .\scripts\dev-ngrok.ps1 -Stop' -ForegroundColor DarkGray
Write-Host ''
