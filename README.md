# Skylens — Weather Analysis on Hadoop MapReduce (React + Express)

Hadoop MapReduce (4 jobs: temperature, rainfall, extremes, humidity & wind) analyses 15 years of daily weather from 20 Indian stations; an Express API serves the results
and live OpenWeather data; a React dashboard visualises everything. (The old Streamlit app is in `legacy/`.)

```
weather.csv ─► HDFS ─► 3 Java MapReduce jobs (YARN) ─► results/*.tsv ─► Express API ─► React UI
                                                         OpenWeather ───────┘
```

## Features
**Live:** city search (worldwide), "near me", current conditions, heat index, air quality, 48 h + 5-day forecast,
live-vs-Hadoop-normal anomaly, smart weather alerts, favourites, °C/°F toggle, auto-refresh, a real Leaflet map (India stations + world cities, click anywhere, temperature/rain/cloud/wind/pressure overlays), a sky that animates to the weather (sun, clouds, rain, thunder, snow, night).
**Hadoop analytics:** overview, temperature, rainfall (seasonality + heatmap), extreme events, station comparison (+ radar),
linear-regression trends & projections, data explorer with CSV export, pipeline status page, light/dark theme.
**Hadoop job:** extreme thresholds are configurable (`-Dweather.heat.threshold`, `-Dweather.rain.threshold`, `-Dweather.wind.threshold`); the UI has a threshold lab.

## Run
Requires Node 18+ (22 recommended).
```bash
cd backend  && npm install && npm start      # http://localhost:5000
cd frontend && npm install && npm run dev    # http://localhost:5173
# or both at once:
scripts/start_all.sh
```
`backend/.env` holds `OPENWEATHER_API_KEY` (server-side only, git-ignored; see `.env.example`).

## Re-run Hadoop (optional — results/ is already exported)
```bash
start-dfs.sh && start-yarn.sh
scripts/run_hadoop.sh            # defaults 35 °C / 50 mm
scripts/run_hadoop.sh 40 80 60   # custom heat / rain / wind thresholds
```
The API re-reads the TSVs when they change; no restart needed.

## API
`/api/live/{alerts,world,current,forecast,air,geocode,stations,insight}` · `/api/hadoop/{atmosphere,summary,temperature,rainfall,extremes,extremes/summary,extremes/custom,leaderboard,climatology,compare,predict,raw,status}` · `/api/tiles/:layer/:z/:x/:y.png` · `/api/health`

## Dataset
`data/weather.csv`: `date,station,tmax_c,tmin_c,prcp_mm,humidity_pct,wind_kmh` (synthetic, 109,580 rows). `python3 generate_weather.py` regenerates it; the original 5 columns are unchanged (backup: `data/weather_v1_backup.csv`).

## Limitations
Synthetic historical data; single-node Hadoop; API reads HDFS over WebHDFS (falls back to exported TSVs); projections are simple regression, not forecasting.
