"""
Weather Analysis Dashboard
===========================
TSV schemas (no headers, tab-separated):
  temperature.tsv  ->  STATION-YEAR \t avg_tmax=...,avg_tmin=...,highest_tmax=...,lowest_tmax=...,observations=...
  rainfall.tsv     ->  STATION-YYYY-MM \t total_rainfall_mm=...,observations=...,rainy_days=...
  extremes.tsv     ->  DATE-STATION \t EXTREME_HEAT,tmax_c=...  |  HEAVY_RAIN,prcp_mm=...
"""

import os, re
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(
    page_title="Weather Analysis — Hadoop MapReduce",
    page_icon="🌦️", layout="wide", initial_sidebar_state="expanded",
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
html,body,[class*="css"]{font-family:'Inter',sans-serif}
.stApp{background:#f0f4f8}
[data-testid="stSidebar"]{background:linear-gradient(180deg,#0f1b2d 0%,#1a2f4a 100%);border-right:1px solid #2a4a6b}
[data-testid="stSidebar"] *{color:#cdd9e8!important}
[data-testid="stSidebar"] h1,[data-testid="stSidebar"] h2,[data-testid="stSidebar"] h3{color:#7ec8e3!important}
[data-testid="metric-container"]{background:white;border:1px solid #dde4ed;border-radius:12px;padding:16px 20px;box-shadow:0 2px 8px rgba(15,27,45,.06);transition:box-shadow .2s}
[data-testid="metric-container"]:hover{box-shadow:0 4px 16px rgba(15,27,45,.12)}
[data-testid="stMetricValue"]{color:#0f1b2d!important;font-weight:700}
[data-testid="stMetricLabel"]{color:#5a7a99!important;font-size:.82rem}
.sh{background:white;border-left:4px solid #1a6ea8;padding:14px 20px;border-radius:0 10px 10px 0;margin:24px 0 16px 0;box-shadow:0 2px 6px rgba(15,27,45,.05)}
.sh h2{margin:0;color:#0f1b2d;font-size:1.2rem;font-weight:600}
.sh p{margin:4px 0 0 0;color:#5a7a99;font-size:.85rem}
.ic{background:white;border:1px solid #dde4ed;border-radius:12px;padding:20px 24px;margin-bottom:16px;box-shadow:0 2px 6px rgba(15,27,45,.05)}
.pt{background:linear-gradient(135deg,#0f1b2d 0%,#1a4a7a 100%);border-radius:16px;padding:32px 36px;margin-bottom:28px}
.pt h1{color:white!important;font-size:2rem;margin:0}
.pt p{color:#7ec8e3!important;margin:8px 0 0 0;font-size:.95rem}
.badge{display:inline-block;background:#e8f4fc;color:#1a6ea8;border:1px solid #bcd9f0;border-radius:20px;padding:3px 12px;font-size:.8rem;font-weight:500;margin:2px 4px}
.bh{background:#fff3e0;color:#e65100;border-color:#ffcc80}
.br{background:#e3f2fd;color:#0277bd;border-color:#90caf9}
.es{text-align:center;padding:60px 20px;color:#5a7a99}
.es h3{font-size:1.1rem;color:#0f1b2d}
</style>
""", unsafe_allow_html=True)

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results")
TEMP_FILE   = os.path.join(RESULTS_DIR, "temperature.tsv")
RAIN_FILE   = os.path.join(RESULTS_DIR, "rainfall.tsv")
EXTR_FILE   = os.path.join(RESULTS_DIR, "extremes.tsv")

def _kv(text):
    out = {}
    for part in text.split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
    return out

@st.cache_data(show_spinner=False)
def load_temperature():
    rows = []
    if not os.path.exists(TEMP_FILE): return pd.DataFrame()
    with open(TEMP_FILE, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.rstrip("\n\r")
            if not line: continue
            parts = line.split("\t", 1)
            if len(parts) != 2: continue
            key, val = parts
            m = re.match(r"^(.+)-(\d{4})$", key)
            if not m: continue
            station, year = m.group(1), m.group(2)
            kv = _kv(val)
            try:
                rows.append({"station":station,"year":int(year),
                    "avg_tmax":float(kv["avg_tmax"]),"avg_tmin":float(kv["avg_tmin"]),
                    "highest_tmax":float(kv["highest_tmax"]),"lowest_tmax":float(kv["lowest_tmax"]),
                    "observations":int(kv["observations"])})
            except (KeyError, ValueError): continue
    return pd.DataFrame(rows)

@st.cache_data(show_spinner=False)
def load_rainfall():
    rows = []
    if not os.path.exists(RAIN_FILE): return pd.DataFrame()
    with open(RAIN_FILE, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.rstrip("\n\r")
            if not line: continue
            parts = line.split("\t", 1)
            if len(parts) != 2: continue
            key, val = parts
            m = re.match(r"^(.+)-(\d{4})-(\d{2})$", key)
            if not m: continue
            station, year, month = m.group(1), m.group(2), m.group(3)
            kv = _kv(val)
            try:
                rows.append({"station":station,"year_month":f"{year}-{month}",
                    "year":int(year),"month":int(month),
                    "total_rainfall_mm":float(kv["total_rainfall_mm"]),
                    "observations":int(kv["observations"]),"rainy_days":int(kv["rainy_days"])})
            except (KeyError, ValueError): continue
    return pd.DataFrame(rows)

@st.cache_data(show_spinner=False)
def load_extremes():
    rows = []
    if not os.path.exists(EXTR_FILE): return pd.DataFrame()
    with open(EXTR_FILE, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.rstrip("\n\r")
            if not line: continue
            parts = line.split("\t", 1)
            if len(parts) != 2: continue
            key, val = parts
            m = re.match(r"^(\d{4}-\d{2}-\d{2})-(.+)$", key)
            if not m: continue
            date_str, station = m.group(1), m.group(2)
            vp = val.split(",", 1)
            event_type = vp[0].strip()
            num = None
            if len(vp) > 1:
                for v in _kv(vp[1]).values():
                    try: num = float(v); break
                    except ValueError: pass
            rows.append({"date":date_str,"station":station,"event_type":event_type,
                         "value":num,"year":int(date_str[:4])})
    df = pd.DataFrame(rows)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df

NAVY = ["#1a6ea8","#e65100","#2e7d32","#6a1b9a","#00838f","#c62828","#558b2f",
        "#1565c0","#f57f17","#4a148c","#006064","#bf360c","#1b5e20","#880e4f",
        "#01579b","#33691e","#4e342e","#37474f","#0277bd","#ad1457"]

CHART = dict(paper_bgcolor="white",plot_bgcolor="#f8fafd",
             font=dict(family="Inter, sans-serif",color="#0f1b2d"),
             title_font=dict(size=15,color="#0f1b2d"),
             legend=dict(bgcolor="rgba(255,255,255,.8)",bordercolor="#dde4ed",borderwidth=1),
             margin=dict(t=50,b=40,l=50,r=20))

MN = {1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",
      7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec"}

def section(title, sub=""):
    s = f"<p>{sub}</p>" if sub else ""
    st.markdown(f'<div class="sh"><h2>{title}</h2>{s}</div>', unsafe_allow_html=True)

def empty_state(msg):
    st.markdown(f'<div class="es"><h3>No data to display</h3><p>{msg}</p></div>',
                unsafe_allow_html=True)

with st.sidebar:
    st.markdown("""
    <div style="text-align:center;padding:20px 0 10px 0">
    <span style="font-size:3rem">🌦️</span>
    <h2 style="color:#7ec8e3!important;font-size:1.1rem;margin:8px 0 0 0">Weather Analysis</h2>
    <p style="color:#5a8aaa!important;font-size:.78rem;margin:4px 0 0 0">Hadoop MapReduce · India</p>
    </div>
    <hr style="border-color:#2a4a6b;margin:12px 0 20px 0">
    """, unsafe_allow_html=True)
    page = st.radio("Navigate", [
        "🏠  Overview","🌡️  Temperature","🌧️  Rainfall",
        "⚡  Extreme Events","🔍  Data Explorer","ℹ️  About Project",
    ], label_visibility="collapsed")
    st.markdown("""
    <hr style="border-color:#2a4a6b;margin:20px 0 12px 0">
    <p style="color:#3a6a8a!important;font-size:.75rem;text-align:center">
    Data from Hadoop HDFS<br>20 stations · 2010–2024</p>
    """, unsafe_allow_html=True)

with st.spinner("Loading MapReduce results…"):
    df_temp = load_temperature()
    df_rain = load_rainfall()
    df_extr = load_extremes()

# ── Overview ──────────────────────────────────────────────────────────────────
if page.startswith("🏠"):
    st.markdown("""<div class="pt"><h1>🌦️ Weather Analysis Using Hadoop MapReduce</h1>
    <p>Distributed weather data processing across 20 Indian cities · 15 years · 3 MapReduce jobs</p>
    </div>""", unsafe_allow_html=True)

    section("Dataset Summary","Metrics from Hadoop MapReduce output files")
    c1,c2,c3,c4,c5,c6 = st.columns(6)
    ns = df_temp["station"].nunique() if not df_temp.empty else 0
    ny = df_temp["year"].nunique()    if not df_temp.empty else 0
    ym = int(df_temp["year"].min())   if not df_temp.empty else "–"
    yx = int(df_temp["year"].max())   if not df_temp.empty else "–"
    c1.metric("Stations",        ns)
    c2.metric("Years Covered",   f"{ym}–{yx}" if ny else "–")
    c3.metric("Temp. Groups",    len(df_temp))
    c4.metric("Rainfall Groups", len(df_rain))
    c5.metric("Extreme Events",  len(df_extr))
    c6.metric("CSV Rows",       "109,581")

    section("MapReduce Pipeline","End-to-end data flow")
    st.markdown("""<div class="ic">
    <table style="width:100%;border-collapse:collapse;text-align:center"><tr>
    <td style="padding:14px;background:#f0f7ff;border-radius:10px;border:1px solid #bcd9f0;width:16%">
      <span style="font-size:1.6rem">📄</span><br><strong style="color:#0f1b2d">weather.csv</strong><br>
      <span style="color:#5a7a99;font-size:.78rem">109,581 rows<br>20 stations</span></td>
    <td style="color:#1a6ea8;font-size:1.4rem;padding:8px">→</td>
    <td style="padding:14px;background:#f0f7ff;border-radius:10px;border:1px solid #bcd9f0;width:16%">
      <span style="font-size:1.6rem">🐘</span><br><strong style="color:#0f1b2d">HDFS</strong><br>
      <span style="color:#5a7a99;font-size:.78rem">/weather/input/</span></td>
    <td style="color:#1a6ea8;font-size:1.4rem;padding:8px">→</td>
    <td style="padding:14px;background:#f0f7ff;border-radius:10px;border:1px solid #bcd9f0;width:22%">
      <span style="font-size:1.6rem">⚙️</span><br><strong style="color:#0f1b2d">Java MapReduce</strong><br>
      <span style="color:#5a7a99;font-size:.78rem">3 jobs: Temp, Rain, Extremes</span></td>
    <td style="color:#1a6ea8;font-size:1.4rem;padding:8px">→</td>
    <td style="padding:14px;background:#f0f7ff;border-radius:10px;border:1px solid #bcd9f0;width:16%">
      <span style="font-size:1.6rem">📊</span><br><strong style="color:#0f1b2d">TSV Results</strong><br>
      <span style="color:#5a7a99;font-size:.78rem">results/*.tsv</span></td>
    <td style="color:#1a6ea8;font-size:1.4rem;padding:8px">→</td>
    <td style="padding:14px;background:#e8f4fc;border-radius:10px;border:1px solid #1a6ea8;width:16%">
      <span style="font-size:1.6rem">🌐</span><br><strong style="color:#1a6ea8">Dashboard</strong><br>
      <span style="color:#5a7a99;font-size:.78rem">Streamlit + Plotly</span></td>
    </tr></table></div>""", unsafe_allow_html=True)

    if not df_temp.empty:
        section("Temperature Snapshot","All-station average temperatures across 2010–2024")
        avg_s = df_temp.groupby("station")[["avg_tmax","avg_tmin"]].mean().reset_index().sort_values("avg_tmax",ascending=False)
        fig = go.Figure()
        fig.add_bar(x=avg_s["station"],y=avg_s["avg_tmax"],name="Avg Max °C",marker_color="#e65100")
        fig.add_bar(x=avg_s["station"],y=avg_s["avg_tmin"],name="Avg Min °C",marker_color="#1a6ea8")
        fig.update_layout(barmode="group",height=380,**CHART,
                          xaxis_title="Station",yaxis_title="Temperature (°C)",
                          yaxis=dict(gridcolor="#eef2f7"))
        st.plotly_chart(fig, use_container_width=True)

    if not df_extr.empty:
        col1,col2 = st.columns(2)
        with col1:
            section("Events by Type")
            hc=(df_extr["event_type"]=="EXTREME_HEAT").sum()
            rc=(df_extr["event_type"]=="HEAVY_RAIN").sum()
            fp=go.Figure(go.Pie(labels=["Extreme Heat (≥35°C)","Heavy Rain (≥50 mm)"],
                values=[hc,rc],marker_colors=["#e65100","#1a6ea8"],hole=0.45,textinfo="label+percent"))
            fp.update_layout(height=300,**CHART,showlegend=True)
            st.plotly_chart(fp,use_container_width=True)
        with col2:
            section("Events per Year")
            yrc=df_extr.groupby("year").size().reset_index(name="count")
            fy=px.bar(yrc,x="year",y="count",color_discrete_sequence=["#1a6ea8"],
                      labels={"count":"Count","year":"Year"})
            fy.update_layout(height=300,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(fy,use_container_width=True)

# ── Temperature ───────────────────────────────────────────────────────────────
elif page.startswith("🌡️"):
    st.markdown("""<div class="pt"><h1>🌡️ Temperature Analysis</h1>
    <p>Annual temperature statistics per station · Job 1 of WeatherAnalysis.java</p>
    </div>""", unsafe_allow_html=True)
    if df_temp.empty:
        empty_state("temperature.tsv could not be loaded.")
    else:
        all_s=sorted(df_temp["station"].unique())
        all_y=sorted(df_temp["year"].unique())
        cs,cy=st.columns([2,2])
        with cs: sel_s=st.multiselect("Station",all_s,default=all_s[:5],key="ts")
        with cy: sel_y=st.multiselect("Year",all_y,default=all_y,key="ty")
        if not sel_s or not sel_y:
            st.info("Select at least one station and year.")
        else:
            f=df_temp[df_temp["station"].isin(sel_s)&df_temp["year"].isin(sel_y)].sort_values(["station","year"])
            section("Annual Average Maximum Temperature (°C)")
            f1=px.line(f,x="year",y="avg_tmax",color="station",markers=True,
                       color_discrete_sequence=NAVY,
                       labels={"avg_tmax":"Avg Max °C","year":"Year","station":"Station"})
            f1.update_layout(height=400,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(f1,use_container_width=True)

            section("Annual Average Minimum Temperature (°C)")
            f2=px.line(f,x="year",y="avg_tmin",color="station",markers=True,
                       color_discrete_sequence=NAVY,
                       labels={"avg_tmin":"Avg Min °C","year":"Year","station":"Station"})
            f2.update_layout(height=400,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(f2,use_container_width=True)

            section("Station × Year Heatmap — Average Max Temperature (°C)")
            piv=f.pivot_table(index="station",columns="year",values="avg_tmax")
            f3=go.Figure(go.Heatmap(z=piv.values,x=piv.columns.astype(str),y=piv.index,
                                     colorscale="RdYlBu_r",colorbar_title="Avg Max °C"))
            f3.update_layout(height=max(300,30*len(sel_s)+80),**CHART,
                             xaxis_title="Year",yaxis_title="Station")
            st.plotly_chart(f3,use_container_width=True)

            section("Absolute Temperature Records")
            r1=f.loc[f["highest_tmax"].idxmax()]
            r2=f.loc[f["lowest_tmax"].idxmin()]
            m1,m2,m3,m4=st.columns(4)
            m1.metric("🔥 Highest Max",f"{f['highest_tmax'].max():.1f} °C",
                      f"{r1['station']} · {r1['year']}")
            m2.metric("❄️ Lowest Max",f"{f['lowest_tmax'].min():.1f} °C",
                      f"{r2['station']} · {r2['year']}")
            m3.metric("Hottest Station",f.groupby("station")["avg_tmax"].mean().idxmax())
            m4.metric("Coolest Station",f.groupby("station")["avg_tmax"].mean().idxmin())

            section("Record Temperatures per Station")
            rec=f.groupby("station").agg(highest_tmax=("highest_tmax","max"),
                lowest_tmax=("lowest_tmax","min")).reset_index().sort_values("highest_tmax",ascending=False)
            f4=go.Figure()
            f4.add_bar(x=rec["station"],y=rec["highest_tmax"],name="Highest Max",marker_color="#e65100")
            f4.add_bar(x=rec["station"],y=rec["lowest_tmax"], name="Lowest Max", marker_color="#1a6ea8")
            f4.update_layout(barmode="group",height=380,**CHART,yaxis=dict(gridcolor="#eef2f7"),
                             xaxis_title="Station",yaxis_title="Temperature (°C)")
            st.plotly_chart(f4,use_container_width=True)

            section("Detailed Data Table")
            disp=f.rename(columns={"station":"Station","year":"Year","avg_tmax":"Avg Max °C",
                "avg_tmin":"Avg Min °C","highest_tmax":"Highest Max °C","lowest_tmax":"Lowest Max °C",
                "observations":"Observations"})
            st.dataframe(disp.set_index(["Station","Year"]),use_container_width=True)
            st.download_button("⬇️ Download CSV",disp.to_csv(index=False).encode(),
                               "temperature_filtered.csv","text/csv")

# ── Rainfall ──────────────────────────────────────────────────────────────────
elif page.startswith("🌧️"):
    st.markdown("""<div class="pt"><h1>🌧️ Rainfall Analysis</h1>
    <p>Monthly rainfall statistics per station · Job 2 of WeatherAnalysis.java</p>
    </div>""", unsafe_allow_html=True)
    if df_rain.empty:
        empty_state("rainfall.tsv could not be loaded.")
    else:
        all_rs=sorted(df_rain["station"].unique())
        all_ry=sorted(df_rain["year"].unique())
        cs,cy=st.columns([2,2])
        with cs: sel_rs=st.multiselect("Station",all_rs,default=all_rs[:5],key="rrs")
        with cy: sel_ry=st.multiselect("Year",all_ry,default=all_ry,key="rry")
        if not sel_rs or not sel_ry:
            st.info("Select at least one station and year.")
        else:
            fr=df_rain[df_rain["station"].isin(sel_rs)&df_rain["year"].isin(sel_ry)].sort_values(["station","year","month"])

            section("Average Monthly Rainfall (mm) — averaged across selected years")
            ma=fr.groupby(["station","month"])["total_rainfall_mm"].mean().reset_index().sort_values("month")
            fm=px.line(ma,x="month",y="total_rainfall_mm",color="station",markers=True,
                       color_discrete_sequence=NAVY,
                       labels={"total_rainfall_mm":"Avg Monthly Rainfall (mm)","month":"Month","station":"Station"})
            fm.update_xaxes(tickvals=list(range(1,13)),ticktext=[MN[i] for i in range(1,13)])
            fm.update_layout(height=420,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(fm,use_container_width=True)

            section("Annual Total Rainfall by Station (mm)")
            ar=fr.groupby(["station","year"])["total_rainfall_mm"].sum().reset_index()
            fa=px.bar(ar,x="year",y="total_rainfall_mm",color="station",barmode="group",
                      color_discrete_sequence=NAVY,
                      labels={"total_rainfall_mm":"Total Rainfall (mm)","year":"Year","station":"Station"})
            fa.update_layout(height=420,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(fa,use_container_width=True)

            section("Monthly Rainy Days Heatmap — avg rainy days per month")
            rp=fr.groupby(["station","month"])["rainy_days"].mean().reset_index()
            rp_t=rp.pivot(index="station",columns="month",values="rainy_days")
            rp_t.columns=[MN[c] for c in rp_t.columns]
            frd=go.Figure(go.Heatmap(z=rp_t.values,x=rp_t.columns,y=rp_t.index,
                                      colorscale="Blues",colorbar_title="Avg Rainy Days"))
            frd.update_layout(height=max(300,30*len(sel_rs)+80),**CHART,
                              xaxis_title="Month",yaxis_title="Station")
            st.plotly_chart(frd,use_container_width=True)

            section("Rainfall Summary")
            m1,m2,m3,m4=st.columns(4)
            m1.metric("Total Rainfall",f"{fr['total_rainfall_mm'].sum():,.0f} mm")
            m2.metric("Total Rainy Days",f"{fr['rainy_days'].sum():,}")
            wet=fr.groupby("station")["total_rainfall_mm"].sum().idxmax()
            dry=fr.groupby("station")["total_rainfall_mm"].sum().idxmin()
            m3.metric("Wettest Station",wet)
            m4.metric("Driest Station",dry)

            section("Detailed Rainfall Data Table")
            dr=fr.rename(columns={"station":"Station","year_month":"Year-Month","year":"Year","month":"Month",
                "total_rainfall_mm":"Total Rainfall (mm)","observations":"Observations","rainy_days":"Rainy Days"})
            st.dataframe(dr.set_index(["Station","Year-Month"]),use_container_width=True)
            st.download_button("⬇️ Download CSV",dr.to_csv(index=False).encode(),
                               "rainfall_filtered.csv","text/csv")

# ── Extreme Events ────────────────────────────────────────────────────────────
elif page.startswith("⚡"):
    st.markdown("""<div class="pt"><h1>⚡ Extreme Weather Events</h1>
    <p>Detected by Job 3 of WeatherAnalysis.java · identity reducer</p>
    </div>""", unsafe_allow_html=True)
    st.markdown("""<div class="ic">
    <strong>Thresholds from ExtremeMapper:</strong><br>
    <span class="badge bh">🔥 EXTREME_HEAT: tmax_c ≥ 35.0 °C</span>
    <span class="badge br">💧 HEAVY_RAIN: prcp_mm ≥ 50.0 mm</span>
    <p style="margin:10px 0 0 0;color:#5a7a99;font-size:.85rem">
    One row per event. A day can appear twice if both thresholds are exceeded.</p>
    </div>""", unsafe_allow_html=True)
    if df_extr.empty:
        empty_state("extremes.tsv could not be loaded.")
    else:
        all_es=sorted(df_extr["station"].unique())
        all_ey=sorted(df_extr["year"].unique())
        all_et=sorted(df_extr["event_type"].unique())
        c1,c2,c3=st.columns(3)
        with c1: sel_es=st.multiselect("Station",all_es,default=all_es,key="ees")
        with c2: sel_ey=st.multiselect("Year",all_ey,default=all_ey,key="eey")
        with c3: sel_et=st.multiselect("Event Type",all_et,default=all_et,key="eet")
        fe=df_extr[df_extr["station"].isin(sel_es)&df_extr["year"].isin(sel_ey)&df_extr["event_type"].isin(sel_et)]
        section("Event Counts")
        hc=(fe["event_type"]=="EXTREME_HEAT").sum()
        rc=(fe["event_type"]=="HEAVY_RAIN").sum()
        m1,m2,m3=st.columns(3)
        m1.metric("Total Events",len(fe))
        m2.metric("🔥 Extreme Heat Days",hc)
        m3.metric("💧 Heavy Rain Days",rc)
        if fe.empty:
            empty_state("No events match the selected filters.")
        else:
            section("Events by Station")
            bs=fe.groupby(["station","event_type"]).size().reset_index(name="count")
            fs=px.bar(bs.sort_values("count",ascending=False),x="station",y="count",color="event_type",
                      barmode="group",color_discrete_map={"EXTREME_HEAT":"#e65100","HEAVY_RAIN":"#1a6ea8"},
                      labels={"count":"Event Count","station":"Station","event_type":"Event Type"})
            fs.update_layout(height=420,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(fs,use_container_width=True)

            section("Events per Year")
            by=fe.groupby(["year","event_type"]).size().reset_index(name="count")
            fy=px.bar(by,x="year",y="count",color="event_type",barmode="stack",
                      color_discrete_map={"EXTREME_HEAT":"#e65100","HEAVY_RAIN":"#1a6ea8"},
                      labels={"count":"Event Count","year":"Year","event_type":"Event Type"})
            fy.update_layout(height=400,**CHART,yaxis=dict(gridcolor="#eef2f7"))
            st.plotly_chart(fy,use_container_width=True)

            section("Event Records Table")
            de=fe.copy()
            de["date"]=de["date"].dt.strftime("%Y-%m-%d")
            de=de.rename(columns={"date":"Date","station":"Station","event_type":"Event Type",
                                   "value":"Measured Value","year":"Year"})
            st.dataframe(de[["Date","Station","Event Type","Measured Value","Year"]],
                         use_container_width=True)
            st.download_button("⬇️ Download CSV",de.to_csv(index=False).encode(),
                               "extremes_filtered.csv","text/csv")

# ── Data Explorer ─────────────────────────────────────────────────────────────
elif page.startswith("🔍"):
    st.markdown("""<div class="pt"><h1>🔍 Data Explorer</h1>
    <p>Browse, search, and download the raw MapReduce result files</p>
    </div>""", unsafe_allow_html=True)
    ds=st.selectbox("Select dataset",[
        "Temperature (temperature.tsv)","Rainfall (rainfall.tsv)","Extreme Events (extremes.tsv)"])
    def explorer(df,fname):
        if df.empty:
            empty_state(f"{fname} is empty or could not be parsed.")
            return
        st.markdown(f"**{len(df):,} rows · {len(df.columns)} columns**")
        sel=st.multiselect("Columns",df.columns.tolist(),default=df.columns.tolist())
        if not sel: st.info("Select at least one column."); return
        srch=st.text_input("🔎 Search","")
        v=df[sel].copy()
        if srch:
            mask=v.apply(lambda c:c.astype(str).str.contains(srch,case=False,na=False))
            v=v[mask.any(axis=1)]
        st.markdown(f"Showing **{len(v):,}** rows")
        st.dataframe(v,use_container_width=True,height=450)
        st.download_button(f"⬇️ Download {fname}",v.to_csv(index=False).encode(),fname,"text/csv")
    if ds.startswith("Temperature"): explorer(df_temp,"temperature.csv")
    elif ds.startswith("Rainfall"):  explorer(df_rain,"rainfall.csv")
    else:
        ex=df_extr.copy()
        if not ex.empty: ex["date"]=ex["date"].dt.strftime("%Y-%m-%d")
        explorer(ex,"extremes.csv")

# ── About ─────────────────────────────────────────────────────────────────────
elif page.startswith("ℹ️"):
    st.markdown("""<div class="pt"><h1>ℹ️ About This Project</h1>
    <p>College project · Weather Analysis Using Hadoop MapReduce</p>
    </div>""", unsafe_allow_html=True)
    t1,t2,t3,t4=st.tabs(["📋 Problem & Objectives","🏗️ Architecture","⚙️ MapReduce Jobs","🛠️ Tools & Limitations"])
    with t1:
        st.markdown("""
### Abstract
Demonstrates **Apache Hadoop MapReduce** for large-scale daily weather analysis across
20 Indian cities (2010–2024). Three distributed Java jobs compute temperature trends,
monthly rainfall, and extreme weather events visualised in a Streamlit dashboard.

### Problem Statement
Traditional single-process analysis struggles with hundreds of thousands of records.
This project applies the **MapReduce programming model** to partition, aggregate, and
summarise weather data on a realistic 109,581-row dataset.

### Objectives
1. Store weather CSV in **HDFS**.
2. Run three **Java MapReduce** jobs.
3. Export results and visualise in **Streamlit + Plotly**.
4. Demonstrate a complete data engineering pipeline.

### Input Dataset
| Field | Description |
|-------|-------------|
| `date` | YYYY-MM-DD |
| `station` | Indian city name |
| `tmax_c` | Max temperature (°C) |
| `tmin_c` | Min temperature (°C) |
| `prcp_mm` | Daily precipitation (mm) |

109,581 rows · 20 stations · 2010–2024
        """)
    with t2:
        st.markdown("""
### Architecture
```
weather.csv → hdfs dfs -put → /weather/input/ (HDFS)
    ↓
Java MapReduce (YARN)
  Job 1: STATION-YEAR     → temperature stats
  Job 2: STATION-YYYY-MM  → rainfall stats
  Job 3: DATE-STATION     → extreme events
    ↓
hdfs dfs -getmerge → results/*.tsv
    ↓
streamlit run app.py → http://localhost:8501
```
Single-node pseudo-distributed cluster on Ubuntu WSL 2.
        """)
    with t3:
        st.markdown("""
### Job 1 — Temperature
- **Map:** `STATION-YEAR` → `tmax_c,tmin_c`
- **Reduce:** `avg_tmax`, `avg_tmin`, `highest_tmax`, `lowest_tmax`, `observations`

### Job 2 — Rainfall
- **Map:** `STATION-YYYY-MM` → `prcp_mm,rainy_flag` (1 if prcp_mm > 0)
- **Reduce:** `total_rainfall_mm`, `observations`, `rainy_days`

### Job 3 — Extreme Events
- **Map:** Emits `DATE-STATION` for tmax ≥ 35 °C or prcp ≥ 50 mm
- **Reduce:** Identity — no aggregation

| Threshold | Label |
|-----------|-------|
| tmax_c ≥ 35.0 °C | `EXTREME_HEAT` |
| prcp_mm ≥ 50.0 mm | `HEAVY_RAIN` |
        """)
    with t4:
        st.markdown("""
### Technologies
| Layer | Technology |
|-------|-----------|
| OS | Ubuntu 26.04 LTS (WSL 2) |
| Distributed storage | Hadoop HDFS 3.5.0 |
| Job scheduler | YARN 3.5.0 |
| Processing | Java MapReduce (Java 17) |
| Dashboard | Python Streamlit ≥ 1.30 |
| Data | Pandas ≥ 2.0 |
| Charts | Plotly ≥ 5.0 |

### Known Limitations
- Single-node — demonstrates MapReduce model, not true distributed gains
- Synthetic dataset — generated values, not real meteorological records
- Static TSV snapshots — no live HDFS connection
- No station coordinates — geographic maps not available

### Future Enhancements
- Real data from Open-Meteo / IMD API
- Multi-node cluster deployment
- HDFS REST API integration
- Time-series forecasting with Prophet
        """)
