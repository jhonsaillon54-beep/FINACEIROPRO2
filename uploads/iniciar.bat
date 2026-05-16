@echo off
title FinancePro v2 — Iniciando...
color 0A
echo.
echo  ==========================================
echo    FINANCEPRO v2 — Iniciando Sistema...
echo  ==========================================
echo.

cd /d "%~dp0backend"

:: Verificar se o ambiente virtual existe
if not exist "venv\Scripts\activate.bat" (
    echo  [1/3] Criando ambiente virtual Python...
    python -m venv venv
    echo  OK!
) else (
    echo  [1/3] Ambiente virtual ja existe. OK!
)

:: Ativar ambiente virtual
call venv\Scripts\activate.bat

:: Instalar dependencias se necessario
echo  [2/3] Verificando dependencias...
pip install -r requirements.txt -q
echo  OK!

:: Rodar setup do banco (cria tabelas se nao existirem)
echo  [3/3] Configurando banco de dados...
python setup.py

echo.
echo  ==========================================
echo    Iniciando servidor na porta 5000...
echo    Abra o frontend com o Live Server!
echo  ==========================================
echo.

python app.py
pause
