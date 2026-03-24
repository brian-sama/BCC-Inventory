import streamlit as st
import pandas as pd
from sqlalchemy import create_engine, text
import plotly.express as px
from datetime import datetime

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="BCC Municipal Asset Intelligence",
    page_icon="🏢",
    layout="wide"
)

# --- DATABASE CONNECTION ---
@st.cache_resource
def get_engine():
    db_url = st.secrets["DATABASE_URL"]
    return create_engine(db_url)

# --- DATA LOADING ---
@st.cache_data(ttl=600)
def load_table(table_name):
    engine = get_engine()
    with engine.connect() as conn:
        df = pd.read_sql(text(f"SELECT * FROM {table_name}"), conn)
    return df

# --- DASHBOARD ---
st.title("📊 Municipal Asset Intelligence Dashboard")
st.markdown("---")

try:
    assets_df = load_table("assets")

    if assets_df.empty:
        st.warning("No asset data found. Please ensure the assets table is populated.")
        st.stop()

    today = pd.Timestamp.now().normalize()

    # --- METRICS ---
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Assets", len(assets_df))

    with col2:
        if 'disposal_date' in assets_df.columns:
            expired = assets_df[pd.to_datetime(assets_df['disposal_date'], errors='coerce') < today]
            st.metric("Expired Assets", len(expired), delta_color="inverse")
        else:
            st.metric("Expired Assets", "N/A")

    with col3:
        if 'disposal_date' in assets_df.columns:
            next_30 = today + pd.Timedelta(days=30)
            upcoming = assets_df[
                (pd.to_datetime(assets_df['disposal_date'], errors='coerce') >= today) &
                (pd.to_datetime(assets_df['disposal_date'], errors='coerce') <= next_30)
            ]
            st.metric("Upcoming Disposals (30d)", len(upcoming))
        else:
            st.metric("Upcoming Disposals", "N/A")

    with col4:
        if 'condition_status' in assets_df.columns:
            good = assets_df[assets_df['condition_status'].str.lower() == 'good']
            st.metric("Healthy Assets", len(good))
        else:
            st.metric("Healthy Assets", "N/A")

    # --- CHARTS ---
    st.markdown("### 📈 Tactical Analytics")
    vcol1, vcol2 = st.columns(2)

    with vcol1:
        if 'condition_status' in assets_df.columns:
            fig = px.pie(assets_df, names='condition_status', title='Asset Condition Distribution',
                         color_discrete_sequence=px.colors.sequential.RdBu)
            st.plotly_chart(fig, use_container_width=True)

    with vcol2:
        dept_col = 'department' if 'department' in assets_df.columns else None
        if dept_col:
            dept_data = assets_df.groupby(dept_col).size().reset_index(name='count')
            fig2 = px.bar(dept_data, x=dept_col, y='count', title='Assets by Department',
                          color='count', color_continuous_scale='Viridis')
            st.plotly_chart(fig2, use_container_width=True)

    # --- ACQUISITION TIMELINE ---
    st.markdown("### 🔍 Procurement & Age Profile")
    if 'purchase_date' in assets_df.columns:
        assets_df['purchase_year'] = pd.to_datetime(assets_df['purchase_date'], errors='coerce').dt.year
        timeline = assets_df.dropna(subset=['purchase_year']).groupby('purchase_year').size().reset_index(name='count')
        fig3 = px.line(timeline, x='purchase_year', y='count',
                       title='Asset Acquisition Timeline', markers=True)
        st.plotly_chart(fig3, use_container_width=True)

    with st.expander("View Raw Asset Data"):
        st.dataframe(assets_df, use_container_width=True)

except Exception as e:
    st.error(f"Dashboard Error: {e}")
    st.info("Make sure DATABASE_URL is set correctly in Streamlit Secrets.")
