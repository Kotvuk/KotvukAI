@echo off
chcp 65001 >nul
title KotvukAI - Крипто Аналитика

:menu
echo.
echo ========================================
echo    KotvukAI - Крипто Аналитика
echo ========================================
echo.
echo Запустить проект? (Y/N)
set /p choice="> "
if /i "%choice%"=="Y" goto start
if /i "%choice%"=="N" goto exit
goto menu

:start
echo.
echo [1/3] Установка зависимостей backend...
cd backend
call npm install
cd ..
echo [2/3] Установка зависимостей frontend...
cd frontend
call npm install
echo [3/3] Сборка frontend...
call npx vite build
cd ..
echo.
echo Запуск сервера...
cd backend
node server.js
cd ..

:restart_menu
echo.
echo ========================================
echo Проект остановлен.
echo ========================================
echo [1] Запустить заново
echo [2] Выйти
set /p rchoice="> "
if "%rchoice%"=="1" goto start
if "%rchoice%"=="2" goto exit
goto restart_menu

:exit
echo До свидания!
pause
exit
