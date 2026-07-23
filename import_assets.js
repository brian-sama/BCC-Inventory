const db = require('./db.js');

const items = [
    {
        asset_name: "Laptop",
        brand: "Lenovo",
        model: "IdeaPad Slim 3 15IRU8",
        serial_number: "PF9YXQ9F",
        notes: "Intel i3-1315U, 8GB RAM, 256GB SSD, 15.6 inch FHD, Integrated GPU, No OS, Arctic Grey, MTM 82X700BVP6\nSource Document: Lenovo box label (photo)",
        purchase_date: "2025-10-11",
        employee_name: "",
        condition_status: "active"
    },
    {
        asset_name: "Laptop",
        brand: "Lenovo",
        model: "IdeaPad Slim 3 15IRU8",
        serial_number: "PF5YP1YY",
        notes: "Intel i3-1315U, 8GB RAM, 256GB SSD, 15.6 inch FHD, Integrated GPU, No OS, Arctic Grey, MTM 82X700BVP5\nSource Document: Lenovo box label (photo)\nBox marked 'i3' in marker",
        purchase_date: null,
        employee_name: "",
        condition_status: "active"
    },
    {
        asset_name: "Desktop PC",
        brand: "HP",
        model: "HP 27 inch All in One",
        serial_number: "1HF5350YXZJ",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nReceived By: E. G. Ngwenya\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Tablet",
        brand: "Samsung Galaxy",
        model: "Galaxy Tab S10 FE 5G",
        serial_number: "R5GY81M82GR",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Tablet",
        brand: "Samsung Galaxy",
        model: "Galaxy Tab S10 FE 5G",
        serial_number: "R5GY1B22WJ8H",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Tablet",
        brand: "Samsung Galaxy",
        model: "Galaxy Tab S10 FE 5G",
        serial_number: "R5GYB3EN6HV",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Laptop",
        brand: "Dell",
        model: "Dell 16 Plus Core i7",
        serial_number: "466VK184",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Laptop",
        brand: "HP OmniBook",
        model: "OmniBook X Flip Core i7",
        serial_number: "VNY60487WR",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Laptop",
        brand: "HP OmniBook",
        model: "OmniBook X Flip Core i7",
        serial_number: "VNY60487WU",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    },
    {
        asset_name: "Smart TV",
        brand: "Hisense",
        model: "Hisense UHD 4K 55 Inch 6 Series",
        serial_number: "55A62QS",
        purchase_date: "2026-07-15",
        notes: "Delivered By: Alfred Nhambiwa\nSource Document: TelOne Vehicle Tracking Equipment Delivery Note",
        employee_name: "E. G. Ngwenya",
        condition_status: "active"
    }
];

async function insertAssets() {
    for (const item of items) {
        const year = new Date().getFullYear();
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const generatedSR = `BCC-SR-${year}-${suffix}`;

        const insertColumns = ['asset_name', 'employee_name', 'asset_code', 'sr_number', 'serial_number', 'condition_status', 'model', 'notes', 'brand', 'purchase_date'];
        const insertValues = [
            item.asset_name,
            item.employee_name,
            generatedSR,
            generatedSR,
            item.serial_number,
            item.condition_status,
            item.model,
            item.notes,
            item.brand,
            item.purchase_date
        ];
        
        const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
        const queryText = `
            INSERT INTO assets (${insertColumns.join(', ')})
            VALUES (${placeholders})
            RETURNING id
        `;

        try {
            const res = await db.query(queryText, insertValues);
            console.log(`Inserted ${item.serial_number} with ID: ${res.rows[0].id}`);
        } catch (err) {
            console.error(`Error inserting ${item.serial_number}:`, err.message);
        }
    }
    process.exit(0);
}

insertAssets();
