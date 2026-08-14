# NIFTY Live Option Chain — Web Edition

A modern web-based NIFTY option chain viewer that connects to **your existing Angel One `.env` credentials** via a Python WebSocket bridge.

## Architecture

```
┌─────────────────┐      ws://localhost:8765      ┌──────────────────┐
│   React App     │  ◄──────────────────────────►  │  Python Bridge   │
│  (Port 3000)    │         JSON over WS           │  (Port 8765)     │
└─────────────────┘                                └──────────────────┘
                                                          │
                                                          │ SmartAPI v2
                                                          ▼
                                                   ┌──────────────────┐
                                                   │  Angel One API   │
                                                   │   (.env auth)    │
                                                   └──────────────────┘
```

## Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.9+** with your existing `.env` file
- Your **Angel One `.env`** file in the project root:
  ```
  API_KEY=your_api_key
  CLIENT_CODE=your_client_code
  PASSWORD=your_password
  TOTP_SECRET=your_totp_secret
  ```

## Quick Start

### Option 1: Run everything together (recommended)

```bash
# 1. Install Node dependencies
npm install

# 2. Install Python bridge dependencies
cd server && pip install -r requirements.txt && cd ..

# 3. Start both bridge + frontend
npm run dev:full
```

This runs:
- Python bridge on `ws://localhost:8765`
- React dev server on `http://localhost:3000`

### Option 2: Run separately (for debugging)

**Terminal 1 — Python Bridge:**
```bash
cd server
pip install -r requirements.txt
python bridge.py
# WebSocket server starts on ws://localhost:8765
```

**Terminal 2 — React Frontend:**
```bash
npm install
npm run dev
# Opens http://localhost:3000
```

### Option 3: Mock data only (no Angel One connection)

If you just want to see the UI without connecting to Angel One:

```bash
npm install
npm run dev
# The frontend will auto-fallback to mock data after 3s
```

## How It Works

### Python Bridge (`server/bridge.py`)

The bridge reuses **your exact terminal script logic**:

1. **Loads `.env`** from the project root (same file your terminal uses)
2. **Generates TOTP** and logs into Angel One SmartAPI
3. **Fetches scrip master** to resolve NIFTY index, futures, and option tokens
4. **Connects to SmartAPI WebSocket v2** and subscribes to:
   - NIFTY index (spot) on NSE
   - Current-month NIFTY futures on NFO
   - All option contracts for next Tuesday expiry
5. **Parses binary WebSocket messages** and broadcasts clean JSON to web clients
6. **Handles reconnection** automatically on disconnect

### Data Flow

The bridge sends three message types to the React app:

```json
// Spot price update
{"type": "spot", "price": 22450.75, "source": "WS"}

// Futures price update
{"type": "futures", "price": 22485.30, "source": "WS"}

// Option contract update
{"type": "option", "strike": 22450, "optionType": "CE", "ltp": 125.50, "oi": 450000, "volume": 12000}

// Full snapshot (sent to new clients)
{"type": "snapshot", "spotPrice": 22450.75, "futuresPrice": 22485.30, ...}
```

### React Frontend

- Connects to `ws://localhost:8765` automatically
- Falls back to **realistic mock data** if the bridge is not running
- Displays live option chain with GSAP-animated cell flashes
- Shows spot, futures, and premium/discount spread
- Auto-centers ATM ± 10 strikes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Table | TanStack Table |
| Animations | GSAP (live cells), Framer Motion (UI) |
| Icons | Lucide React |
| Backend | Python 3, `websockets`, `SmartApi` |
| Data Source | Angel One SmartAPI v2 |

## Project Structure

```
nifty-option-chain-web/
├── .env                          # Your Angel One credentials (shared!)
├── server/
│   ├── bridge.py                 # Python WebSocket bridge
│   └── requirements.txt          # Python deps
├── src/
│   ├── components/
│   │   ├── MarketHeader.tsx      # Spot/Futures/Spread header
│   │   ├── OptionChainTable.tsx  # Main TanStack table
│   │   ├── OICell.tsx            # OI display with GSAP flash
│   │   ├── LTPCell.tsx           # LTP with change arrows
│   │   ├── StrikeCell.tsx        # Strike with ATM highlighting
│   │   ├── VolumeBar.tsx         # Animated volume bars
│   │   ├── ATMMarker.tsx         # ATM/Max OI badges
│   │   ├── Legend.tsx            # Color legend
│   │   ├── ConnectionStatus.tsx  # WS status indicator
│   │   └── SettingsPanel.tsx     # Settings drawer
│   ├── store/
│   │   └── marketStore.ts        # Zustand state management
│   ├── hooks/
│   │   ├── useGSAPFlash.ts       # GSAP animation hooks
│   │   └── useWebSocket.ts       # Bridge connection hook
│   ├── data/
│   │   └── mockGenerator.ts      # Fallback mock data
│   ├── types/
│   │   └── market.ts             # TypeScript interfaces
│   ├── lib/
│   │   └── utils.ts              # Formatting helpers
│   ├── App.tsx                   # Main app component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Tailwind + custom styles
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Customization

### Change the strike window
Edit `src/components/OptionChainTable.tsx`:
```typescript
// Default: ATM ± 10 strikes
return optionData.slice(Math.max(0, centerIdx - 10), ...)
// Change 10 to your preferred range
```

### Adjust animation speed
Edit `src/hooks/useGSAPFlash.ts`:
```typescript
duration: 0.3,  // Flash duration in seconds
ease: 'power2.out',
```

### Change WebSocket port
Edit both files:
- `server/bridge.py`: `BroadcastServer(host='localhost', port=8765)`
- `src/hooks/useWebSocket.ts`: `const BRIDGE_URL = 'ws://localhost:8765'`

## Troubleshooting

### "Cannot connect to bridge"
- Make sure `server/bridge.py` is running
- Check that port 8765 is not blocked by firewall
- The frontend will auto-fallback to mock data after 3 seconds

### "Login failed" in bridge
- Verify your `.env` file has all 4 credentials
- Check TOTP secret is correct (no spaces)
- Ensure your Angel One account is active

### "No options found"
- The bridge fetches next Tuesday expiry by default
- If today is expiry day after 3:30 PM, it looks for next week
- Check the bridge logs for the symbol pattern it's searching

### CORS errors
- The Python bridge runs on `localhost:8765` with no CORS restrictions
- If you deploy to a server, update the bridge's `host` to `0.0.0.0`

## Performance Notes

- **Zustand** selectors prevent unnecessary re-renders
- **TanStack Table** handles 50+ rows at 60fps
- **GSAP** runs on GPU — no layout thrashing
- **Python bridge** batches option updates and sends them as fast as SmartAPI provides them
- The frontend throttles store updates to prevent React overload during high volatility

## License

MIT

---

**Your `.env` file stays in the project root. Both the terminal script and the web bridge read from the same file.**
