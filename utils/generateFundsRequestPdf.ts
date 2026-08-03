import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface FundRequestItem {
  description: string;
  quantity: number;
  unitCost: number;
}

export interface FundRequestCategory {
  categoryName: string;
  items: FundRequestItem[];
}

export interface FundRequestData {
  organizationHeader: {
    line1: string;
    line2: string;
    line3: string;
    tel: string;
    email: string;
  };
  title: string;
  description: string;
  categories: FundRequestCategory[];
  preparedBy: string;
  date: string;
}

export const generateFundsRequestPdf = (data: FundRequestData) => {
  const doc = new jsPDF();
  let currentY = 15;

  // --- Header Section ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.organizationHeader.line1, 14, currentY);
  currentY += 5;
  doc.text(data.organizationHeader.line2, 14, currentY);
  currentY += 5;
  doc.text(data.organizationHeader.line3, 14, currentY);
  currentY += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Tel: ${data.organizationHeader.tel}`, 14, currentY);
  currentY += 5;
  doc.text(`E-mail: ${data.organizationHeader.email}`, 14, currentY);

  // Note: Add your MMPZ logo on the top right here if available via base64:
  // doc.addImage(logoBase, 'PNG', 150, 12, 45, 20);

  currentY += 10;
  doc.setLineWidth(0.5);
  doc.line(14, currentY, 196, currentY);
  currentY += 10;

  // --- Title & Description ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.title, 105, currentY, { align: "center" });
  
  currentY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const splitDescription = doc.splitTextToSize(data.description, 182);
  doc.text(splitDescription, 14, currentY);
  
  currentY += (splitDescription.length * 5) + 8;

  // --- Table Construction ---
  const tableRows: any[] = [];
  let grandTotal = 0;

  data.categories.forEach((cat) => {
    // Category Subheader Row
    tableRows.push([{ content: cat.categoryName, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [189, 215, 238] } }]);
    
    cat.items.forEach((item) => {
      const total = item.quantity * item.unitCost;
      grandTotal += total;
      tableRows.push([
        item.description,
        item.quantity,
        `US$  ${item.unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `US$  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);
    });
  });

  // Grand Total Row
  tableRows.push([
    { content: '', colSpan: 2, styles: { fillColor: [255, 255, 255] } },
    { content: 'US$', styles: { fontStyle: 'bold', halign: 'right' } },
    { content: `${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold' } }
  ]);

  (doc as any).autoTable({
    startY: currentY,
    head: [['DETAILS / ITEMS TO BE PURCHASED', 'QUANTITY', 'UNIT COST $', 'AMOUNT']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    }
  });

  // --- Footer / Signatures ---
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Prepared by : ${data.preparedBy}`, 14, finalY);
  doc.text(`Date : ${data.date}`, 95, finalY);
  doc.text(`Signature : ............................................`, 135, finalY);

  doc.save(`Request_for_Funds_${data.title.replace(/\s+/g, '_')}.pdf`);
};
