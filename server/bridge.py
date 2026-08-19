# -*- coding: utf-8 -*-
"""
NIFTY Option Chain WebSocket Bridge
Multi-instrument support: NIFTY, BANKNIFTY, FINNIFTY, SENSEX, MIDCPNIFTY
Expiry selection support

Usage:
    cd server && python bridge.py
"""

import os
import sys
import json
import asyncio
import threading
import time
from datetime import datetime, timedelta
from typing import Set, Dict, Any, Optional, List

import requests
import pandas as pd
import pyotp
from dotenv import load_dotenv
from logzero import logger

script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '..', '.env')
load_dotenv(env_path, override=True)

API_KEY     = os.getenv("API_KEY", "").strip()
CLIENT_CODE = os.getenv("CLIENT_CODE", "").strip()
PASSWORD    = os.getenv("PASSWORD", "").strip()
TOTP_SECRET = os.getenv("TOTP_SECRET", "").strip()

if not all([API_KEY, CLIENT_CODE, PASSWORD, TOTP_SECRET]):
    print("ERROR: Missing credentials in .env")
    sys.exit(1)

SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"

try:
    from SmartApi import SmartConnect
    from SmartApi.smartWebSocketV2 import SmartWebSocketV2
except ImportError as e:
    logger.error(f"SmartApi not installed: {e}")
    sys.exit(1)

# ------------------------------------------------------------------
# Instrument Configs
# ------------------------------------------------------------------
INSTRUMENT_CONFIGS = {
    'NIFTY': {
        'name': 'NIFTY',
        'index_token': '99926000',
        'exchange': 'NSE',
        'futures_exchange': 'NFO',
        'strike_step': 50,
    },
    'BANKNIFTY': {
        'name': 'BANKNIFTY',
        'index_token': '99926009',
        'exchange': 'NSE',
        'futures_exchange': 'NFO',
        'strike_step': 100,
    },
    'FINNIFTY': {
        'name': 'FINNIFTY',
        'index_token': '99926037',
        'exchange': 'NSE',
        'futures_exchange': 'NFO',
        'strike_step': 50,
    },
    'SENSEX': {
        'name': 'SENSEX',
        'index_token': '99919000',
        'exchange': 'BSE',
        'futures_exchange': 'BFO',
        'strike_step': 100,
    },
    'MIDCPNIFTY': {
        'name': 'MIDCPNIFTY',
        'index_token': '99926074',
        'exchange': 'NSE',
        'futures_exchange': 'NFO',
        'strike_step': 100,
    },
}

# ------------------------------------------------------------------
# Auth Manager
# ------------------------------------------------------------------
class AuthManager:
    def __init__(self):
        self.smart_api = SmartConnect(API_KEY)
        self.jwt_token = None
        self.feed_token = None
        self.last_login = 0
        self.token_expiry = 55 * 60
        self.lock = threading.RLock()

    def login(self):
        with self.lock:
            try:
                logger.info("[Bridge] Attempting login...")
                totp = pyotp.TOTP(TOTP_SECRET).now()
                login_data = self.smart_api.generateSession(
                    clientCode=CLIENT_CODE,
                    password=PASSWORD,
                    totp=totp
                )
                if not login_data["status"]:
                    logger.error(f"[Bridge] Login Failed: {login_data.get('message')}")
                    return False
                self.jwt_token = login_data["data"]["jwtToken"]
                self.feed_token = login_data["data"].get("feedToken", self.smart_api.getfeedToken())
                self.last_login = time.time()
                logger.info("[Bridge] Login successful")
                return True
            except Exception as e:
                logger.error(f"[Bridge] Login error: {e}")
                return False

    def get_valid_jwt(self):
        with self.lock:
            if time.time() - self.last_login > self.token_expiry:
                logger.warning("[Bridge] Token expired, refreshing...")
                if not self.login():
                    raise ConnectionError("Token refresh failed")
            return self.jwt_token

    def get_valid_feed_token(self):
        self.get_valid_jwt()
        with self.lock:
            return self.feed_token


# ------------------------------------------------------------------
# Scrip Master + Multi-Instrument Support
# ------------------------------------------------------------------
_scrip_master_df: Optional[pd.DataFrame] = None
_scrip_master_loaded_at: float = 0

def get_scrip_master() -> pd.DataFrame:
    global _scrip_master_df, _scrip_master_loaded_at
    if _scrip_master_df is not None and time.time() - _scrip_master_loaded_at < 3600:
        return _scrip_master_df
    try:
        response = requests.get(SCRIP_MASTER_URL, timeout=15)
        response.raise_for_status()
        _scrip_master_df = pd.DataFrame(response.json())
        _scrip_master_loaded_at = time.time()
        logger.info(f"[Bridge] Scrip master loaded: {len(_scrip_master_df)} rows")
        return _scrip_master_df
    except Exception as e:
        logger.error(f"[Bridge] Failed to fetch scrip master: {e}")
        raise


def get_instrument_info(df: pd.DataFrame, instrument: str):
    """Get index and futures info for any instrument."""
    cfg = INSTRUMENT_CONFIGS[instrument]

    # Index
    idx_filter = (
        (df['name'].str.strip().str.upper() == instrument) &
        (df['exch_seg'] == cfg['exchange']) &
        (df['instrumenttype'].str.strip().isin(['AMXIDX', 'IDX', '']))
    )
    idx_df = df[idx_filter]
    if len(idx_df) == 0:
        raise ValueError(f"{instrument} index not found")
    idx = idx_df.iloc[0]
    index_info = {'token': str(idx['token']), 'symbol': str(idx['symbol']), 'name': str(idx['name'])}

    # Futures
    fut_filter = (
        (df['name'].str.strip().str.upper() == instrument) &
        (df['exch_seg'] == cfg['futures_exchange']) &
        (df['instrumenttype'].str.strip() == 'FUTIDX')
    )
    fut_df = df[fut_filter].copy()
    futures_info = None
    if len(fut_df) > 0:
        fut_df['expiry_dt'] = pd.to_datetime(fut_df['expiry'], format='%d%b%Y')
        fut_df = fut_df.sort_values('expiry_dt')
        f = fut_df.iloc[0]
        futures_info = {'token': str(f['token']), 'symbol': str(f['symbol']), 'expiry': str(f['expiry'])}

    return index_info, futures_info


def get_available_expiries(df: pd.DataFrame, instrument: str) -> List[str]:
    """Get all available weekly/monthly expiries for an instrument."""
    cfg = INSTRUMENT_CONFIGS[instrument]
    opt_filter = (
        (df['instrumenttype'].str.strip() == 'OPTIDX') &
        (df['exch_seg'] == cfg['futures_exchange']) &
        (df['name'].str.strip().str.upper() == instrument)
    )
    opt_df = df[opt_filter].copy()
    if len(opt_df) == 0:
        return []
    opt_df['expiry_dt'] = pd.to_datetime(opt_df['expiry'], format='%d%b%Y')
    opt_df = opt_df.sort_values('expiry_dt')
    expiries = opt_df['expiry'].unique().tolist()
    return [str(e) for e in expiries]


def get_options_for_expiry(df: pd.DataFrame, instrument: str, expiry: str):
    """Get option contracts for a specific expiry date."""
    cfg = INSTRUMENT_CONFIGS[instrument]
    opt_filter = (
        (df['instrumenttype'].str.strip() == 'OPTIDX') &
        (df['exch_seg'] == cfg['futures_exchange']) &
        (df['name'].str.strip().str.upper() == instrument) &
        (df['expiry'] == expiry)
    )
    options = df[opt_filter].copy()
    if len(options) == 0:
        return None
    options['strike'] = options['strike'].astype(float) / 100
    options['strike'] = options['strike'].astype(int)
    options['expiry'] = pd.to_datetime(options['expiry'], format='%d%b%Y').dt.strftime('%d-%b-%Y')
    return options


def get_next_tuesday_expiry(expiries: List[str]) -> str:
    """Find the next Tuesday expiry from available expiries."""
    today = datetime.now()
    for exp in sorted(expiries):
        try:
            exp_dt = datetime.strptime(exp, '%d%b%Y')
            if exp_dt >= today:
                return exp
        except:
            continue
    return expiries[0] if expiries else ''


# ------------------------------------------------------------------
# Broadcast Server
# ------------------------------------------------------------------
class BroadcastServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients: Set[Any] = set()
        self.lock = asyncio.Lock()
        self.option_data: Dict[int, Dict[str, Any]] = {}
        self.data_lock = threading.Lock()
        self.spot_price: Optional[float] = None
        self.futures_price: Optional[float] = None
        self.spot_source: str = ""
        self.futures_source: str = ""
        self.expiry_date: str = ""
        self.available_expiries: List[str] = []
        self.message_count = 0

    async def register(self, websocket):
        async with self.lock:
            self.clients.add(websocket)
            logger.info(f"[Bridge] Client connected. Total: {len(self.clients)}")
            await self._send_snapshot(websocket)

    async def unregister(self, websocket):
        async with self.lock:
            self.clients.discard(websocket)
            logger.info(f"[Bridge] Client disconnected. Total: {len(self.clients)}")

    def broadcast_sync(self, message: dict, loop: asyncio.AbstractEventLoop):
        asyncio.run_coroutine_threadsafe(self._broadcast(message), loop)

    async def _broadcast(self, message: dict):
        if not self.clients:
            return
        payload = json.dumps(message)
        dead = set()
        async with self.lock:
            for ws in self.clients:
                try:
                    await ws.send(payload)
                except Exception:
                    dead.add(ws)
            self.clients -= dead

    async def _send_snapshot(self, websocket):
        with self.data_lock:
            snapshot = {
                "type": "snapshot",
                "spotPrice": self.spot_price,
                "futuresPrice": self.futures_price,
                "spotSource": self.spot_source,
                "futuresSource": self.futures_source,
                "expiryDate": self.expiry_date,
                "availableExpiries": self.available_expiries,
                "optionData": self.option_data,
                "messageCount": self.message_count,
            }
        try:
            await websocket.send(json.dumps(snapshot))
        except Exception as e:
            logger.debug(f"[Bridge] Snapshot send failed: {e}")

    def update_option(self, strike: int, option_type: str, ltp: float, oi: int, volume: int):
        with self.data_lock:
            if strike not in self.option_data:
                self.option_data[strike] = {"CE": {}, "PE": {}}
            old = self.option_data[strike].get(option_type, {})
            self.option_data[strike][option_type] = {
                "ltp": ltp, "oi": oi, "volume": volume,
                "prevOi": old.get("oi", oi),
                "change": oi - old.get("oi", oi),
                "lastUpdate": time.time(),
            }

    async def handler(self, websocket):
        await self.register(websocket)
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    action = data.get("action")
                    if action == "ping":
                        await websocket.send(json.dumps({"type": "pong"}))
                    elif action == "subscribe":
                        instrument = data.get("instrument", "NIFTY")
                        expiry = data.get("expiry")
                        logger.info(f"[Bridge] Client requested: {instrument} / {expiry}")
                        await websocket.send(json.dumps({
                            "type": "ack",
                            "instrument": instrument,
                            "expiry": expiry,
                        }))
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"[Bridge] WS handler error: {e}")
        finally:
            await self.unregister(websocket)


# ------------------------------------------------------------------
# Angel One Bridge (Multi-Instrument)
# ------------------------------------------------------------------
class AngelOneBridge:
    def __init__(self, broadcast_server: BroadcastServer):
        self.server = broadcast_server
        self.auth_manager = AuthManager()
        self.sws = None
        self.token_map: Dict[str, Dict[str, Any]] = {}
        self.index_info: Optional[Dict] = None
        self.futures_info: Optional[Dict] = None
        self.running = True
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._reconnecting = False
        self.current_instrument = 'NIFTY'
        self.current_expiry = ''
        self.scrip_df = None

    def setup(self, instrument: str = 'NIFTY', expiry: Optional[str] = None):
        self.current_instrument = instrument
        self.scrip_df = get_scrip_master()

        cfg = INSTRUMENT_CONFIGS[instrument]
        self.index_info = {
            'token': cfg['index_token'],
            'symbol': instrument,
            'name': instrument,
        }

        # Get futures info
        try:
            _, futures_info = get_instrument_info(self.scrip_df, instrument)
            self.futures_info = futures_info
        except Exception as e:
            logger.warning(f"[Bridge] No futures for {instrument}: {e}")
            self.futures_info = None

        # Log futures status
        if self.futures_info:
            logger.info(f"[Bridge] Futures found: {self.futures_info['symbol']} token={self.futures_info['token']}")
        else:
            logger.warning(f"[Bridge] No futures contract found for {instrument}")

        # Get available expiries
        self.server.available_expiries = get_available_expiries(self.scrip_df, instrument)
        logger.info(f"[Bridge] Available expiries for {instrument}: {self.server.available_expiries}")

        # Determine expiry
        if expiry and expiry in self.server.available_expiries:
            self.current_expiry = expiry
        else:
            self.current_expiry = get_next_tuesday_expiry(self.server.available_expiries)

        if not self.current_expiry:
            logger.error(f"[Bridge] No expiry found for {instrument}")
            return False

        self.server.expiry_date = self.current_expiry
        logger.info(f"[Bridge] Using expiry: {self.current_expiry}")

        # Build token map for options
        options = get_options_for_expiry(self.scrip_df, instrument, self.current_expiry)
        if options is None or len(options) == 0:
            logger.error(f"[Bridge] No options for {instrument} {self.current_expiry}")
            return False

        self.token_map = {}
        for _, row in options.iterrows():
            self.token_map[str(row['token'])] = {
                'strike': int(row['strike']),
                'type': 'CE' if 'CE' in row['symbol'] else 'PE',
            }

        logger.info(f"[Bridge] {instrument}: {len(self.token_map)} options for {self.current_expiry}")
        return True

    def start(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        if not self.auth_manager.login():
            logger.error("[Bridge] Initial login failed")
            return
        self._init_websocket()

    def _init_websocket(self):
        retry_count = 0
        max_retries = 5
        while self.running and retry_count < max_retries:
            try:
                jwt = self.auth_manager.get_valid_jwt()
                feed = self.auth_manager.get_valid_feed_token()
                self.sws = SmartWebSocketV2(
                    auth_token=jwt,
                    api_key=API_KEY,
                    client_code=CLIENT_CODE,
                    feed_token=feed
                )
                self.sws.on_open = self._on_open
                self.sws.on_data = self._on_data
                self.sws.on_error = self._on_error
                self.sws.on_close = self._on_close
                logger.info("[Bridge] Connecting to Angel One WebSocket...")
                self.sws.connect()
                return
            except Exception as e:
                logger.error(f"[Bridge] WS init error: {e}")
                retry_count += 1
                time.sleep(2 ** retry_count)
        logger.error("[Bridge] Max WS retries reached")

    def _on_open(self, wsapp):
        logger.info("[Bridge] WebSocket Connected [OK]")
        cfg = INSTRUMENT_CONFIGS[self.current_instrument]

        # Subscribe index
        try:
            exch_type = 1 if cfg['exchange'] == 'NSE' else 13  # BSE = 13
            self.sws.subscribe("index_spot", 1, [{
                "exchangeType": exch_type,
                "tokens": [self.index_info['token']]
            }])
            logger.info(f"[Bridge] Subscribed {self.current_instrument} index {self.index_info['token']} on {cfg['exchange']}")
        except Exception as e:
            logger.error(f"[Bridge] Index sub error: {e}")

        # Subscribe futures
        if self.futures_info:
            try:
                fut_exch = 2 if cfg['futures_exchange'] == 'NFO' else 12  # BFO = 12
                self.sws.subscribe("futures_ltp", 1, [{
                    "exchangeType": fut_exch,
                    "tokens": [self.futures_info['token']]
                }])
                logger.info(f"[Bridge] Subscribed futures {self.futures_info['token']}")
            except Exception as e:
                logger.error(f"[Bridge] Futures sub error: {e}")

        # Subscribe options
        tokens = list(self.token_map.keys())
        opt_exch = 2 if cfg['futures_exchange'] == 'NFO' else 12
        for i in range(0, len(tokens), 50):
            chunk = [{"exchangeType": opt_exch, "tokens": tokens[i:i+50]}]
            try:
                self.sws.subscribe("oi_stream", 3, chunk)
                logger.info(f"[Bridge] Subscribed batch {i//50 + 1}: {len(chunk[0]['tokens'])} tokens")
            except Exception as e:
                logger.error(f"[Bridge] Sub error: {e}")

    def _on_data(self, wsapp, message):
        try:
            token = str(message.get('token', ''))
            cfg = INSTRUMENT_CONFIGS[self.current_instrument]

            # Spot update
            if token == self.index_info['token']:
                ltp = float(message.get('last_traded_price', 0) or 0) / 100.0
                self.server.spot_price = ltp
                self.server.spot_source = "WS"
                self.server.message_count += 1
                self.server.broadcast_sync({"type": "spot", "price": ltp, "source": "WS"}, self.loop)
                return

            # Futures update
            if self.futures_info and token == self.futures_info['token']:
                ltp = float(message.get('last_traded_price', 0) or 0) / 100.0
                self.server.futures_price = ltp
                self.server.futures_source = "WS"
                self.server.message_count += 1
                self.server.broadcast_sync({"type": "futures", "price": ltp, "source": "WS"}, self.loop)
                return

            # Option update
            if token not in self.token_map:
                return

            info = self.token_map[token]
            ltp_raw = message.get('last_traded_price', 0) or 0
            oi = message.get('open_interest', 0) or 0
            volume = message.get('volume_trade_for_the_day', 0) or 0
            ltp = float(ltp_raw) / 100.0
            strike = info['strike']
            option_type = info['type']

            self.server.update_option(strike, option_type, ltp, oi, volume)
            self.server.message_count += 1
            self.server.broadcast_sync({
                "type": "option",
                "strike": strike,
                "optionType": option_type,
                "ltp": ltp,
                "oi": oi,
                "volume": volume,
            }, self.loop)

        except Exception as e:
            logger.error(f"[Bridge] Data error: {e}")

    def _on_error(self, wsapp, error):
        logger.error(f"[Bridge] WS Error: {error}")
        self._reconnect()

    def _on_close(self, wsapp):
        logger.info("[Bridge] WS Closed")
        self._reconnect()

    def _reconnect(self):
        if self._reconnecting:
            return
        self._reconnecting = True
        logger.info("[Bridge] Reconnecting in 5s...")
        time.sleep(5)
        try:
            self.auth_manager.login()
            self._init_websocket()
        except Exception as e:
            logger.error(f"[Bridge] Reconnect failed: {e}")
        finally:
            self._reconnecting = False

    def stop(self):
        self.running = False
        if self.sws:
            try:
                self.sws.close_connection()
            except Exception:
                pass


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
async def main():
    loop = asyncio.get_running_loop()

    server = BroadcastServer(host='localhost', port=8765)
    import websockets
    ws_server = await websockets.serve(server.handler, server.host, server.port)
    logger.info(f"[Bridge] WebSocket server started on ws://{server.host}:{server.port}")

    bridge = AngelOneBridge(server)

    # Default to NIFTY
    if not bridge.setup('NIFTY'):
        logger.error("[Bridge] Setup failed")
        ws_server.close()
        return

    angel_thread = threading.Thread(target=bridge.start, args=(loop,), daemon=True)
    angel_thread.start()

    logger.info("[Bridge] Ready for web clients. Press Ctrl+C to stop.")
    logger.info("[Bridge] NOTE: Market is closed after 15:30 IST. No live ticks until next session.")

    try:
        await asyncio.Future()
    except KeyboardInterrupt:
        logger.info("[Bridge] Shutting down...")
    finally:
        bridge.stop()
        ws_server.close()
        await ws_server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())
