import streamlit as st
import pandas as pd
import psycopg2
import os
from datetime import datetime
import plotly.express as px

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="BCC Municipal Asset Intelligence",
    page_icon="🏢",
    layout="wide"
)

# --- DB CONNECTION ---
def get_connection():
    # Streamlit Cloud uses st.secrets for environment variables
    db_url = st.secrets.get("DATABASE_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        st.error("DATABASE_URL not found. Please configure it in Streamlit Secrets.")
        st.stop()
    return psycopg2.connect(db_url)

# --- DATA LOADING ---
@st.cache_data(ttl=600)
def load_data(table_name):
    conn = get_connection()
    query = f"SELECT * FROM {table_name}"
    df = pd.read_sql(query, conn)
    conn.close()
    return df

# --- DASHBOARD UI ---
st.title("📊 Municipal Asset Intelligence Dashboard")
st.markdown("---")

try:
    # Load Assets
    assets_df = load_data("assets")
    
    # --- METRICS ---
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Total Assets", len(assets_df))
    
    with col2:
        # Calculate expired
        today = datetime.now().date()
        expired_count = len(assets_df[pd.to_datetime(assets_df['disposal_date']).dt.date < today])
        st.metric("Expired Assets", expired_count, delta_color="inverse")
        
    with col3:
        # Calculate upcoming disposals (next 30 days)
        next_30 = today + pd.Timedelta(days=30)
        upcoming = len(assets_df[
            (pd.to_datetime(assets_df['disposal_date']).dt.date >= today) & 
            (pd.to_datetime(assets_df['disposal_date']).dt.date <= next_30)
        ])
        st.metric("Upcoming Disposals", upcoming)

    with col4:
        # Asset Condition
        good_condition = len(assets_df[assets_df['condition_status'].str.lower() == 'good'])
        st.metric("Healthy Assets", good_condition)

    # --- VISUALIZATIONS ---
    st.markdown("### 📈 Tactical Analytics")
    
    vcol1, vcol2 = st.columns(2)
    
    with vcol1:
        # Condition chart
        fig_cond = px.pie(assets_df, names='condition_status', title='Asset Condition Distribution',
                         color_discrete_sequence=px.colors.sequential.RdBu)
        st.plotly_chart(fig_cond, use_container_width=True)
        
    with vcol2:
        # Department chart
        fig_dept = px.bar(assets_df.groupby('department').size().reset_index(name='count'), 
                         x='department', y='count', title='Assets by Department',
                         color='count', color_continuous_scale='Viridis')
        st.plotly_chart(fig_dept, use_container_width=True)

    # --- ADVANCED VIEW ---
    st.markdown("### 🔍 Procurement & Age Profile")
    
    # Group by purchase date (year)
    assets_df['purchase_year'] = pd.to_datetime(assets_df['purchase_date']).dt.year
    age_profile = assets_df.groupby('purchase_year').size().reset_index(name='count')
    
    fig_age = px.line(age_profile, x='purchase_year', y='count', 
                     title='Asset Acquisition Timeline', markers=True)
    st.plotly_chart(fig_age, use_container_width=True)

    # Data Table
    with st.expander("View Raw Asset Data"):
        st.dataframe(assets_df, use_container_width=True)

except Exception as e:
    st.error(f"Error connecting to database or rendering dashboard: {e}")
    st.info("Ensure the PostgreSQL database schema is migrated and accessible.")
