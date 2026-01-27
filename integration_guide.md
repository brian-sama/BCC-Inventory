# BCC System Integration Guide: Inventory ↔ Repairs

This guide explains how to connect the **Repairs System (Netlify)** to the **Inventory Registry**.

## 1. Get SR Number from Inventory (Repairs System)

When a technician enters a Serial Number in the Repairs app, you can automatically fetch the SR Number using this API call.

### API Endpoint

- **URL**: `https://your-inventory-app-url.host/api/external/asset/[SERIAL_NUMBER]`
- **Method**: `GET`
- **Headers**:
  - `x-api-key`: `BCC_REPAIRS_SYNC_2024`

### Example Javascript (Fetch)

```javascript
async function getAssetDetails(serial) {
  const response = await fetch(`https://your-inventory-app.netlify.app/api/external/asset/${serial}`, {
    headers: { 'x-api-key': 'BCC_REPAIRS_SYNC_2024' }
  });
  const data = await response.json();
  if (data.success) {
    console.log("SR Number:", data.srNumber);
    console.log("Owner:", data.owner);
  }
}
```

## 2. Share Repair Status with Inventory (Repairs System)

To show the "In Repair" badge in the Inventory Registry, the Repairs system needs to provide a status.

### Recommended Setup

1. In your Repairs Supabase database, ensure you have a `jobs` or `tickets` table.
2. Create an API endpoint in your Repairs server:
   - **URL**: `/api/external/repair-status/:serial`
   - **Returns**: `{ "inRepair": true, "status": "Under Repair", "jobId": "123" }`

## 3. Configuration in Inventory System

Once the Repairs system has the status endpoint ready, update the `REPAIRS_API_URL` in the Inventory System's `.env` or settings.

## 4. Environment Variables (Repairs System)

Since your Repairs App uses Vite, add these to your `.env` file:

```bash
# Connection to Inventory System
VITE_INVENTORY_API_URL=http://localhost:3001
# (Or production URL: https://your-inventory.netlify.app)

# Secure Access Key
VITE_INVENTORY_API_KEY=BCC_REPAIRS_SYNC_2024
```
