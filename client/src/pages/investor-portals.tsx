import os
import random
from flask import Flask, jsonify, request
import firebase_admin
from firebase_admin import credentials, storage

app = Flask(__name__)

# --- BANKER'S BASELINE (Fallbacks only) ---
DEFAULT_FORECAST = 75  
DEFAULT_CLOSE = 60     
# ------------------------------------------

SONG_ASSETS = [
    {"id": 0, "title": "BETTER THAN GOOD", "file": "BETTER THAN GOOD (1).mp3", "floor": 0.85, "ceiling": 2.50},
    {"id": 1, "title": "I'M NOT HER", "file": "I'M NOT HER.mp3", "floor": 0.90, "ceiling": 3.00},
    {"id": 4, "title": "SILENT CRIES", "file": "SILENT CRIES NOBODY HEARS.mp3", "floor": 0.95, "ceiling": 5.00},
    {"id": 5, "title": "G-SPOT CLASSIC", "file": "G_SPOT_RECORDS_THEME.mp3", "floor": 1.20, "ceiling": 10.00},
]

if not firebase_admin._apps:
    cred = credentials.Certificate("/etc/secrets/firebase-key.json") 
    firebase_admin.initialize_app(cred, {'storageBucket': 'aititrade-radio-97.firebasestorage.app'})
bucket = storage.bucket()

@app.route('/')
def mbbo_terminal():
    # THE POWER: Pulling live regulation from the URL
    forecast = request.args.get('forecast', DEFAULT_FORECAST, type=int)
    close = request.args.get('close', DEFAULT_CLOSE, type=int)
    
    ticker_html = f"""
    <body style='background:black;color:#00ff00;font-family:monospace;padding:20px;'>
    <div style='display:flex; justify-content:space-between; align-items:center;'>
        <h1 style='color:white;'>97.7 THE FLAME | MARKET TERMINAL</h1>
        <div style='color:#ff00ff; font-size:24px;'>RAPID RESET: <span id='timer'>4:30</span></div>
    </div>
    <div style='color:#444; font-size:12px; margin-bottom:10px;'>REGULATION ACTIVE: MF@{forecast}% / CLOSE@{close}%</div>
    <hr style='border:1px solid #222;'>
    <div id='portal-container' style='display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px; margin-top:20px;'>
    """
    
    for song in SONG_ASSETS:
        current_pct = random.randint(0, 100)
        market_price = round(song['floor'] + (song['ceiling'] - song['floor']) * (current_pct / 100), 2)
        
        # Banker's Function: The verb "Market Close"
        is_closed = current_pct >= close
        color = "#ff00ff" if is_closed else "#00ff00"
        
        ticker_html += f"""
        <div style='border:2px solid {color}; padding:20px; background:#111; border-radius:8px; box-shadow: 0 0 10px {color}44;'>
            <h3 style='color:white; margin:0;'>{song['title']}</h3>
            <div style='font-size:32px; margin:10px 0; color:{color};'>${market_price}</div>
            <div style='color:#555;'>MKT POSITION: {current_pct}%</div>
            <div style='margin-top:15px; font-weight:bold; color:{color};'>
                [{'MARKET CLOSED' if is_closed else 'MARKET OPEN'}]
            </div>
            <div style='font-size:10px; color:#333; margin-top:5px;'>FORECAST: @{forecast}%</div>
        </div>
        """
    
    ticker_html += f"""
    </div>
    <script>
        let timeLeft = 270; 
        setInterval(() => {{
            timeLeft = timeLeft > 0 ? timeLeft - 1 : 270;
            let mins = Math.floor(timeLeft / 60);
            let secs = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('timer').innerText = mins + ":" + secs;
            
            // Kinetic Logic: Tick the market every 4 seconds
            if (timeLeft % 4 === 0) {{ 
                window.location.href = window.location.pathname + window.location.search; 
            }}
        }}, 1000);
    </script>
    </body>
    """
    return ticker_html

@app.route('/api/market-data', methods=['GET'])
def get_market_data():
    forecast = request.args.get('forecast', DEFAULT_FORECAST, type=int)
    close = request.args.get('close', DEFAULT_CLOSE, type=int)
    
    live_assets = []
    for song in SONG_ASSETS:
        current_pct = random.randint(0, 100)
        market_price = round(song['floor'] + (song['ceiling'] - song['floor']) * (current_pct / 100), 2)
        live_assets.append({
            "id": song['id'], 
            "title": song['title'], 
            "floor": song['floor'],
            "current_price": market_price, 
            "current_pct": current_pct,
            "is_closed": current_pct >= close
        })
    return jsonify({"assets": live_assets, "regulator": {"forecast": forecast, "close": close}})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
