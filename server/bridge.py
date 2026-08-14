# -*- coding: utf-8 -*-
"""
NIFTY Option Chain WebSocket Bridge
Reuses your .env + Angel One SmartAPI connection.
Broadcasts clean JSON to all connected web clients.

Usage:
    cd server && python bridge.py
    # Then in another terminal: npm run dev
"""

import os
import sys
import json
import asyncio
import threading
import time
from datetime import datetime, timedelta
from typing import Set, Dict, Any, Optional

import requests
import pandas as pd
import pyotp
from dotenv import load_dotenv
from logzero import logger

# ------------------------------------------------------------------
# 0. Load .env (same as your terminal script)
# ------------------------------------------------------------------
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '..', '.env')
load_dotenv(env_path, override=True)

API_KEY     = os.getenv("API_KEY", "").strip()
CLIENT_CODE = os.getenv("CLIENT_CODE", "").strip()
PASSWORD    = os.getenv("PASSWORD", "").strip()
TOTP_SECRET = os.getenv("TOTP_SECRET", "").strip()

if not all([API_KEY, CLIENT_CODE, PASSWORD, TOTP_SECRET]):
    print("ERROR: Missing credentials in .env")
    print(f"Looking at: {env_path}  (exists={os.path.exists(env_path)})")
    sys.exit(1)

# ------------------------------------------------------------------
# 1. Angel One Auth (same logic as terminal)
# ------------------------------------------------------------------
SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"

try:
    from SmartApi import SmartConnect
    from SmartApi.smartWebSocketV2 import SmartWebSocketV2
except ImportError as e:
    logger.error(f"SmartApi not installed: {e}")
    logger.error("Run: pip install smartapi-python")
    sys.exit(1)


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
# 2. Scrip Master + Expiry Logic (same as terminal)
# ------------------------------------------------------------------
def get_next_tuesday():
    today = datetime.now()
    days_ahead = (1 - today.weekday() + 7) % 7
    if days_ahead == 0:
        if today.hour >= 15 and today.minute >= 30:
            days_ahead = 7
    next_tue = today + timedelta(days=days_ahead)
    return next_tue, next_tue.strftime('%d-%b-%Y').upper()


def fetch_option_chain():
    try:
        response = requests.get(SCRIP_MASTER_URL, timeout=15)
        response.raise_for_status()
        df = pd.DataFrame(response.json())
    except Exception as e:
        logger.error(f"[Bridge] Failed to fetch scrip master: {e}")
        raise

    # NIFTY Index
    nifty_filter = (
        (df['name'].str.strip().str.upper() == 'NIFTY') &
        (df['exch_seg'] == 'NSE') &
        (df['instrumenttype'].isin(['AMXIDX', 'IDX', '']))
    )
    nifty_df = df[nifty_filter]
    if len(nifty_df) == 0:
        raise ValueError("NIFTY index not found in scrip master")
    nifty_index = nifty_df.iloc[0]
    nifty_info = {
        'token': str(nifty_index['token']),
        'symbol': str(nifty_index['symbol']),
        'name': str(nifty_index['name']),
    }

    # Current Month Future
    fut_filter = (
        (df['name'].str.strip().str.upper() == 'NIFTY') &
        (df['exch_seg'] == 'NFO') &
        (df['instrumenttype'] == 'FUTIDX')
    )
    fut_df = df[fut_filter].copy()
    futures_info = None
    if len(fut_df) > 0:
        fut_df['expiry_dt'] = pd.to_datetime(fut_df['expiry'], format='%d%b%Y')
        fut_df = fut_df.sort_values('expiry_dt')
        futures_index = fut_df.iloc[0]
        futures_info = {
            'token': str(futures_index['token']),
            'symbol': str(futures_index['symbol']),
            'expiry': str(futures_index['expiry']),
        }

    # Options for next Tuesday
    optidx_df = df[
        (df['instrumenttype'] == 'OPTIDX') &
        (df['exch_seg'] == 'NFO')
    ]
    next_tue, expiry_str = get_next_tuesday()
    symbol_pattern = f"NIFTY{next_tue.strftime('%d%b%y').upper()}"

    nifty_options = optidx_df[
        optidx_df['symbol'].str.startswith(symbol_pattern, na=False)
    ].copy()

    if len(nifty_options) == 0:
        logger.warning(f"[Bridge] No options for pattern: {symbol_pattern}")
        sample = optidx_df[optidx_df['symbol'].str.startswith('NIFTY', na=False)]['symbol'].unique()[:10]
        logger.warning(f"[Bridge] Sample symbols: {list(sample)}")

    nifty_options['strike'] = nifty_options['strike'].astype(float) / 100
    nifty_options['strike'] = nifty_options['strike'].astype(int)
    nifty_options['expiry'] = pd.to_datetime(
        nifty_options['expiry'], format='%d%b%Y'
    ).dt.strftime('%d-%b-%Y')

    logger.info(f"[Bridge] Loaded {len(nifty_options)} contracts for {expiry_str}")
    return nifty_options, expiry_str, nifty_info, futures_info


# ------------------------------------------------------------------
# 3. WebSocket Broadcast Server
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
        """Thread-safe broadcast from any thread."""
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
        """Send current state to a newly connected client."""
        with self.data_lock:
            snapshot = {
                "type": "snapshot",
                "spotPrice": self.spot_price,
                "futuresPrice": self.futures_price,
                "spotSource": self.spot_source,
                "futuresSource": self.futures_source,
                "expiryDate": self.expiry_date,
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
                "ltp": ltp,
                "oi": oi,
                "volume": volume,
                "prevOi": old.get("oi", oi),
                "change": oi - old.get("oi", oi),
                "lastUpdate": time.time(),
            }

    # FIX: websockets 17.x passes only (websocket), not (websocket, path)
    async def handler(self, websocket):
        await self.register(websocket)
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    if data.get("action") == "ping":
                        await websocket.send(json.dumps({"type": "pong"}))
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"[Bridge] WS handler error: {e}")
        finally:
            await self.unregister(websocket)


# ------------------------------------------------------------------
# 4. Angel One WebSocket Integration (Thread-Safe)
# ------------------------------------------------------------------
class AngelOneBridge:
    def __init__(self, broadcast_server: BroadcastServer):
        self.server = broadcast_server
        self.auth_manager = AuthManager()
        self.sws = None
        self.token_map: Dict[str, Dict[str, Any]] = {}
        self.nifty_info: Optional[Dict] = None
        self.futures_info: Optional[Dict] = None
        self.running = True
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def setup(self, nifty_options, expiry_str, nifty_info, futures_info):
        self.nifty_info = nifty_info
        self.futures_info = futures_info
        self.server.expiry_date = expiry_str
        self.token_map = {}
        for _, row in nifty_options.iterrows():
            self.token_map[str(row['token'])] = {
                'strike': int(row['strike']),
                'type': 'CE' if 'CE' in row['symbol'] else 'PE',
            }
        logger.info(f"[Bridge] Token map: {len(self.token_map)} options")

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

        # Subscribe NIFTY index
        try:
            self.sws.subscribe("index_spot", 1, [{
                "exchangeType": 1,
                "tokens": [self.nifty_info['token']]
            }])
            logger.info(f"[Bridge] Subscribed NIFTY index {self.nifty_info['token']}")
        except Exception as e:
            logger.error(f"[Bridge] Index sub error: {e}")

        # Subscribe futures
        if self.futures_info:
            try:
                self.sws.subscribe("futures_ltp", 1, [{
                    "exchangeType": 2,
                    "tokens": [self.futures_info['token']]
                }])
                logger.info(f"[Bridge] Subscribed futures {self.futures_info['token']}")
            except Exception as e:
                logger.error(f"[Bridge] Futures sub error: {e}")

        # Subscribe options in batches
        tokens = list(self.token_map.keys())
        for i in range(0, len(tokens), 50):
            chunk = [{"exchangeType": 2, "tokens": tokens[i:i+50]}]
            try:
                self.sws.subscribe("oi_stream", 3, chunk)
                logger.info(f"[Bridge] Subscribed batch {i//50 + 1}: {len(chunk[0]['tokens'])} tokens")
            except Exception as e:
                logger.error(f"[Bridge] Sub error: {e}")

    def _on_data(self, wsapp, message):
        try:
            token = str(message.get('token', ''))

            # Spot update
            if token == self.nifty_info['token']:
                ltp = float(message.get('last_traded_price', 0) or 0) / 100.0
                self.server.spot_price = ltp
                self.server.spot_source = "WS"
                self.server.message_count += 1
                self.server.broadcast_sync({
                    "type": "spot",
                    "price": ltp,
                    "source": "WS"
                }, self.loop)
                return

            # Futures update
            if self.futures_info and token == self.futures_info['token']:
                ltp = float(message.get('last_traded_price', 0) or 0) / 100.0
                self.server.futures_price = ltp
                self.server.futures_source = "WS"
                self.server.message_count += 1
                self.server.broadcast_sync({
                    "type": "futures",
                    "price": ltp,
                    "source": "WS"
                }, self.loop)
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
        logger.info("[Bridge] Reconnecting in 5s...")
        time.sleep(5)
        try:
            self.auth_manager.login()
            self._init_websocket()
        except Exception as e:
            logger.error(f"[Bridge] Reconnect failed: {e}")

    def stop(self):
        self.running = False
        if self.sws:
            try:
                self.sws.close_connection()
            except Exception:
                pass


# ------------------------------------------------------------------
# 5. Main Entry Point
# ------------------------------------------------------------------
async def main():
    loop = asyncio.get_running_loop()

    # Start broadcast server
    server = BroadcastServer(host='localhost', port=8765)
    import websockets
    ws_server = await websockets.serve(server.handler, server.host, server.port)
    logger.info(f"[Bridge] WebSocket server started on ws://{server.host}:{server.port}")

    # Fetch option chain
    try:
        options_df, expiry_str, nifty_info, futures_info = fetch_option_chain()
        logger.info(f"[Bridge] Expiry: {expiry_str}")
        logger.info(f"[Bridge] NIFTY Spot Token: {nifty_info['token']}")
        if futures_info:
            logger.info(f"[Bridge] NIFTY Fut Token: {futures_info['token']}")
    except Exception as e:
        logger.error(f"[Bridge] Setup failed: {e}")
        ws_server.close()
        return

    # Start Angel One connection in background thread
    bridge = AngelOneBridge(server)
    bridge.setup(options_df, expiry_str, nifty_info, futures_info)

    angel_thread = threading.Thread(target=bridge.start, args=(loop,), daemon=True)
    angel_thread.start()

    logger.info("[Bridge] Angel One connection started in background")
    logger.info("[Bridge] Ready for web clients. Press Ctrl+C to stop.")
    logger.info("[Bridge] NOTE: Market is closed after 15:30 IST. No live ticks until next session.")

    try:
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        logger.info("[Bridge] Shutting down...")
    finally:
        bridge.stop()
        ws_server.close()
        await ws_server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())
