import os

import pandas as pd
import plotly.express as px
import streamlit as st
from sqlalchemy import create_engine, text


def load_local_env():
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()


st.set_page_config(
    page_title="BCC Municipal Asset Intelligence",
    page_icon="🏢",
    layout="wide",
)


@st.cache_resource
def get_engine():
    db_url = st.secrets.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured in Streamlit secrets or environment variables.")
    return create_engine(db_url)


@st.cache_data(ttl=600)
def load_table(table_name):
    if table_name not in {"assets"}:
        raise ValueError("Unsupported table requested.")

    engine = get_engine()
    with engine.connect() as conn:
        return pd.read_sql(text(f"SELECT * FROM {table_name}"), conn)


st.title("📊 Municipal Asset Intelligence Dashboard")
st.markdown("---")

try:
    assets_df = load_table("assets")

    if assets_df.empty:
        st.warning("No asset data found. Please ensure the assets table is populated.")
        st.stop()

    today = pd.Timestamp.now().normalize()
    disposal_dates = pd.to_datetime(assets_df.get("disposal_date"), errors="coerce")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Assets", len(assets_df))

    with col2:
        if "disposal_date" in assets_df.columns:
            st.metric("Expired Assets", int((disposal_dates < today).sum()), delta_color="inverse")
        else:
            st.metric("Expired Assets", "N/A")

    with col3:
        if "disposal_date" in assets_df.columns:
            next_30 = today + pd.Timedelta(days=30)
            upcoming = (disposal_dates >= today) & (disposal_dates <= next_30)
            st.metric("Upcoming Disposals (30d)", int(upcoming.sum()))
        else:
            st.metric("Upcoming Disposals", "N/A")

    with col4:
        if "condition_status" in assets_df.columns:
            status = assets_df["condition_status"].fillna("").astype(str).str.lower().str.strip()
            healthy = status.isin(["good", "active", "working"])
            st.metric("Healthy Assets", int(healthy.sum()))
        else:
            st.metric("Healthy Assets", "N/A")

    st.markdown("### 📈 Tactical Analytics")
    vcol1, vcol2 = st.columns(2)

    with vcol1:
        if "condition_status" in assets_df.columns:
            fig = px.pie(
                assets_df,
                names="condition_status",
                title="Asset Condition Distribution",
                color_discrete_sequence=px.colors.sequential.RdBu,
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Condition status data is not available.")

    with vcol2:
        if "department" in assets_df.columns:
            dept_data = assets_df.groupby("department", dropna=False).size().reset_index(name="count")
            fig2 = px.bar(
                dept_data,
                x="department",
                y="count",
                title="Assets by Department",
                color="count",
                color_continuous_scale="Viridis",
            )
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("Department data is not available.")

    st.markdown("### 🔍 Procurement & Age Profile")
    if "purchase_date" in assets_df.columns:
        assets_df["purchase_year"] = pd.to_datetime(assets_df["purchase_date"], errors="coerce").dt.year
        timeline = assets_df.dropna(subset=["purchase_year"]).groupby("purchase_year").size().reset_index(name="count")
        if timeline.empty:
            st.info("No valid purchase dates available for the acquisition timeline.")
        else:
            fig3 = px.line(timeline, x="purchase_year", y="count", title="Asset Acquisition Timeline", markers=True)
            st.plotly_chart(fig3, use_container_width=True)
    else:
        st.info("Purchase date data is not available.")

    with st.expander("View Raw Asset Data"):
        st.dataframe(assets_df, use_container_width=True)

except Exception as e:
    st.error(f"Dashboard Error: {e}")
    st.info("Make sure DATABASE_URL is set correctly in Streamlit secrets or environment variables.")
