@echo off
echo ===================================
echo   CYNA - Déploiement Netlify
echo ===================================
echo.

cd /d "%~dp0"

echo [1/3] Récupération du code...
git fetch origin
git checkout claude/debug-terminal-issue-uvSBY
git pull origin claude/debug-terminal-issue-uvSBY
if errorlevel 1 (
  echo ERREUR: git pull échoué
  pause
  exit /b 1
)

echo.
echo [2/3] Construction de l'application...
call npm run build
if errorlevel 1 (
  echo ERREUR: build échoué
  pause
  exit /b 1
)

echo.
echo [3/3] Déploiement sur Netlify...
call netlify deploy --prod --dir=build
if errorlevel 1 (
  echo ERREUR: deploy échoué
  pause
  exit /b 1
)

echo.
echo ✅ Déploiement terminé avec succès !
pause
