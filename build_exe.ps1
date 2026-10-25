# PowerShell script to build ScrollSnip Windows EXE
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "      ScrollSnip v2.0.0 - Windows EXE Builder (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "[Error] Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Python 3.10+ from python.org and check 'Add Python to PATH'." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/4] Checking Python Virtual Environment..." -ForegroundColor Green
if (-not (Test-Path "venv/Scripts/Activate.ps1")) {
    Write-Host "Creating virtual environment 'venv'..." -ForegroundColor Gray
    python -m venv venv
}

& .\venv\Scripts\Activate.ps1

Write-Host "[2/4] Installing dependencies & PyInstaller..." -ForegroundColor Green
python -m pip install --upgrade pip
pip install -r requirements.txt pyinstaller

Write-Host "[3/4] Running pytest..." -ForegroundColor Green
pytest tests/ -v

Write-Host "[4/4] Compiling ScrollSnip.exe..." -ForegroundColor Green
pyinstaller --clean ScrollSnip.spec

if (Test-Path "dist/ScrollSnip.exe") {
    $size = (Get-Item "dist/ScrollSnip.exe").Length / 1MB
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " SUCCESS: dist\ScrollSnip.exe created ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Invoke-Item "dist"
} else {
    Write-Host "[Error] dist/ScrollSnip.exe was not created." -ForegroundColor Red
}
