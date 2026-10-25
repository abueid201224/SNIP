@echo off
chcp 65001 >nul
title بناء ScrollSnip التنفيذي لنظام ويندوز

echo ========================================================
echo       ScrollSnip v2.0.0 - Windows EXE Builder
echo ========================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطأ] بايثون غير مثبت أو غير مضاف إلى متغيرات البيئة PATH!
    echo يرجى تثبيت Python 3.10+ من python.org وتفعيل Add to PATH.
    pause
    exit /b 1
)

echo [1/4] التحقق من البيئة الافتراضية venv...
if not exist "venv\Scripts\activate.bat" (
    echo إنشاء بيئة افتراضية جديدة...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo.
echo [2/4] تثبيت المتطلبات و PyInstaller...
python -m pip install --upgrade pip
pip install -r requirements.txt pyinstaller

echo.
echo [3/4] تشغيل اختبارات الوحدة pytest...
pytest tests/
if %errorlevel% neq 0 (
    echo [تحذير] فشل في أحد الاختبارات، هل تريد الاستمرار في البناء؟
    pause
)

echo.
echo [4/4] بناء الملف التنفيذي ScrollSnip.exe عبر PyInstaller...
pyinstaller --clean ScrollSnip.spec

if exist "dist\ScrollSnip.exe" (
    echo.
    echo ========================================================
    echo  تم إنشاء الملف التنفيذي بنجاح في:
    echo  dist\ScrollSnip.exe
    echo ========================================================
    echo.
    explorer.exe dist
) else (
    echo.
    echo [خطأ] تعذّر إنشاء الملف التنفيذي. راجع السجلات أعلاه.
)

pause
