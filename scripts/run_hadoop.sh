#!/usr/bin/env bash
# Full pipeline: generate data -> HDFS -> 3 MapReduce jobs -> export TSVs for the API.
# Usage: scripts/run_hadoop.sh [heat_threshold] [rain_threshold] [wind_threshold]
set -euo pipefail
cd "$(dirname "$0")/.."
HEAT=${1:-35}; RAIN=${2:-50}; WIND=${3:-40}

[ -f data/weather.csv ] || python3 generate_weather.py
mkdir -p build results

echo "▶ compiling"
javac -classpath "$(hadoop classpath)" -d build src/WeatherAnalysis.java
jar -cf weather-analysis.jar -C build .

echo "▶ uploading to HDFS"
hdfs dfs -mkdir -p /weather/input
hdfs dfs -put -f data/weather.csv /weather/input/weather.csv
hdfs dfs -rm -r -f /weather/output >/dev/null 2>&1 || true

echo "▶ running jobs (heat>=$HEAT, rain>=$RAIN, wind>=$WIND)"
hadoop jar weather-analysis.jar WeatherAnalysis \
  -Dweather.heat.threshold="$HEAT" -Dweather.rain.threshold="$RAIN" -Dweather.wind.threshold="$WIND" \
  /weather/input/weather.csv /weather/output/temperature /weather/output/rainfall /weather/output/extremes /weather/output/atmosphere

echo "▶ exporting results"
for j in temperature rainfall extremes atmosphere; do
  rm -f "results/$j.tsv" "results/.$j.tsv.crc"
  hdfs dfs -getmerge "/weather/output/$j" "results/$j.tsv"
  rm -f "results/.$j.tsv.crc"
done
echo "✔ done — the API picks up the new TSVs automatically"
