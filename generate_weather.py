import csv
import random
from datetime import date, timedelta

random.seed(42)
# Separate stream for humidity/wind so tmax/tmin/prcp stay identical to the original dataset.
atmo = random.Random(2024)

stations = {
    "CHENNAI": (32, 26),
    "COIMBATORE": (30, 21),
    "MADURAI": (34, 25),
    "TRICHY": (34, 25),
    "SALEM": (32, 23),
    "BENGALURU": (28, 19),
    "MYSURU": (29, 20),
    "HYDERABAD": (33, 23),
    "KOCHI": (31, 25),
    "THIRUVANANTHAPURAM": (31, 25),
    "MUMBAI": (32, 26),
    "PUNE": (31, 20),
    "DELHI": (34, 21),
    "KOLKATA": (33, 25),
    "AHMEDABAD": (36, 24),
    "JAIPUR": (35, 22),
    "BHOPAL": (32, 22),
    "LUCKNOW": (34, 22),
    "VISAKHAPATNAM": (32, 26),
    "MANGALORE": (31, 25),
}

# (base relative humidity %, base wind km/h)
atmosphere = {
    "CHENNAI": (72, 15), "COIMBATORE": (60, 13), "MADURAI": (58, 12), "TRICHY": (57, 11), "SALEM": (60, 11),
    "BENGALURU": (62, 12), "MYSURU": (62, 10), "HYDERABAD": (55, 11), "KOCHI": (78, 13), "THIRUVANANTHAPURAM": (77, 13),
    "MUMBAI": (74, 16), "PUNE": (58, 10), "DELHI": (50, 10), "KOLKATA": (73, 11), "AHMEDABAD": (48, 13),
    "JAIPUR": (42, 12), "BHOPAL": (52, 10), "LUCKNOW": (56, 9), "VISAKHAPATNAM": (72, 16), "MANGALORE": (77, 14),
}

start_date = date(2010, 1, 1)
end_date = date(2024, 12, 31)
days = (end_date - start_date).days + 1

with open("data/weather.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["date", "station", "tmax_c", "tmin_c", "prcp_mm", "humidity_pct", "wind_kmh"])

    for station, (normal_max, normal_min) in stations.items():
        for day_number in range(days):
            d = start_date + timedelta(days=day_number)
            seasonal = 3 * __import__("math").sin(
                2 * __import__("math").pi * (d.timetuple().tm_yday / 365.25)
            )
            tmax = normal_max + seasonal + random.gauss(0, 2.5)
            tmin = normal_min + seasonal + random.gauss(0, 2.0)
            tmin = min(tmin, tmax - 1)

            # More rain during selected monsoon months
            wet_months = (6, 7, 8, 9)
            rain_chance = 0.45 if d.month in wet_months else 0.12
            rain = random.expovariate(1 / 12) if random.random() < rain_chance else 0
            rain = min(rain, 150)

            base_h, base_w = atmosphere[station]
            monsoon = d.month in wet_months
            humidity = base_h + (12 if monsoon else -4) + (10 if rain > 0 else 0) \
                - 0.8 * (tmax - normal_max) + atmo.gauss(0, 6)
            humidity = max(15.0, min(100.0, humidity))
            wind = atmo.weibullvariate(base_w * (1.25 if monsoon else 0.95), 2.0)
            if atmo.random() < (0.035 if monsoon else 0.008):  # squalls / cyclonic gusts
                wind += atmo.expovariate(1 / 22)
            wind = min(wind, 120.0)

            writer.writerow([
                d.isoformat(), station,
                round(tmax, 1), round(tmin, 1), round(rain, 1),
                round(humidity, 1), round(wind, 1)
            ])

print(f"Generated {len(stations) * days:,} weather records.")
