export function generateCSV(data: Record<string, any>[]): string {
  if (data.length === 0) {
    return '';
  }

  // Collect all unique column names while preserving consistent order
  // Use a Map to maintain insertion order
  const columnMap = new Map<string, number>();
  data.forEach(record => {
    Object.keys(record).forEach(key => {
      if (!columnMap.has(key)) {
        columnMap.set(key, columnMap.size);
      }
    });
  });
  const headers = Array.from(columnMap.keys());

  // Helper function to escape and normalize CSV values
  function escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Convert objects/arrays to JSON strings
    let stringValue: string;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }
    
    // If the value contains comma, quote, newline, or starts with =+-@ (formula injection prevention)
    const needsQuoting = 
      stringValue.includes(',') || 
      stringValue.includes('"') || 
      stringValue.includes('\n') ||
      stringValue.includes('\r') ||
      /^[=+\-@]/.test(stringValue);
    
    if (needsQuoting) {
      // Escape existing quotes by doubling them
      const escaped = stringValue.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    
    return stringValue;
  }

  // Generate header row
  const headerRow = headers.map(h => escapeCSVValue(h)).join(',');

  // Generate data rows - ensure consistent column order
  const dataRows = data.map(record => {
    return headers.map(header => {
      const value = record[header];
      return escapeCSVValue(value);
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}
