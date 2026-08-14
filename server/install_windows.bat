@echo off
echo ==========================================
echo  NIFTY Option Chain - Windows Setup
echo ==========================================
echo.

REM Step 1: Crypto replacement (pre-built wheel)
echo [1/5] Installing pycryptodome (pre-built)...
pip install pycryptodome

REM Step 2: SmartApi without broken PyCrypto dependency
echo [2/5] Installing SmartApi (no-deps mode)...
pip install smartapi --no-deps

REM Step 3: SmartApi's missing dependencies
echo [3/5] Installing SmartApi dependencies...
pip install isodate pytz rdflib simplejson

REM Step 4: Bridge dependencies
echo [4/5] Installing bridge dependencies...
pip install websockets python-dotenv pandas requests pyotp logzero

REM Step 5: Create PyCrypto shim for smartapi
echo [5/5] Creating PyCrypto compatibility shim...
python -c "import sys, os; site=next(p for p in sys.path if 'site-packages' in p); os.makedirs(f'{site}/PyCrypto', exist_ok=True); open(f'{site}/PyCrypto/__init__.py','w').write('from Crypto import *\n')"

REM Verify
echo.
echo Verifying installation...
python -c "from SmartApi import SmartConnect; print('  SmartApi OK')"
python -c "import Crypto; print('  Crypto OK')"
python -c "import websockets; print('  websockets OK')"
python -c "import pandas; print('  pandas OK')"

echo.
echo ==========================================
echo  Setup complete! Run: python bridge.py
echo ==========================================
pause
