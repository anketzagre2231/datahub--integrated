export function exportToCSV<T>(
  data: T[], 
  headers: string[], 
  filename: string, 
  rowMapper: (item: T) => any[]
) {
  if (!data || data.length === 0) return;
  
  const csvRows = [headers.join(",")];
  
  for (const item of data) {
    const rawRow = rowMapper(item);
    const escapedRow = rawRow.map(val => `"${String(val ?? "").replace(/"/g, '""')}"`);
    csvRows.push(escapedRow.join(","));
  }
  
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
