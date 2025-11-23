function escapeIdentifier(identifier: string): string {
  // Escape SQL identifiers by wrapping in double quotes and escaping existing quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

function inferSQLType(columnName: string, values: any[]): string {
  let hasNull = false;
  let hasNumber = false;
  let hasBoolean = false;
  let hasString = false;
  let allIntegers = true;
  let maxLength = 0;

  for (const value of values) {
    if (value === null || value === undefined) {
      hasNull = true;
      continue;
    }

    const type = typeof value;
    
    if (type === 'boolean') {
      hasBoolean = true;
    } else if (type === 'number') {
      hasNumber = true;
      if (!Number.isInteger(value) || !Number.isFinite(value)) {
        allIntegers = false;
      }
    } else if (type === 'string') {
      hasString = true;
      maxLength = Math.max(maxLength, value.length);
    } else {
      // Objects/arrays - treat as text
      hasString = true;
      const strValue = String(value);
      maxLength = Math.max(maxLength, strValue.length);
    }
  }

  // Type priority: boolean > number > string
  if (hasBoolean && !hasNumber && !hasString) {
    return 'BOOLEAN';
  }
  
  if (hasNumber && !hasString) {
    if (allIntegers) {
      return 'BIGINT'; // Use BIGINT to handle large numbers
    }
    return 'DOUBLE PRECISION'; // Better than DECIMAL(10,2) for arbitrary decimals
  }

  // String type
  if (maxLength === 0) {
    return 'TEXT';
  } else if (maxLength <= 255) {
    return 'VARCHAR(255)';
  } else {
    return 'TEXT';
  }
}

export function generateSQL(
  data: Record<string, any>[],
  tableName: string = 'converted_data'
): string {
  if (data.length === 0) {
    return '-- No data to convert';
  }

  // Sanitize table name (remove special chars but keep underscores)
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');

  // Collect all unique column names while preserving order
  const columnSet = new Set<string>();
  data.forEach(record => {
    Object.keys(record).forEach(key => columnSet.add(key));
  });
  const columns = Array.from(columnSet);

  // Infer column types
  const columnTypes = new Map<string, string>();
  columns.forEach(col => {
    const values = data.map(record => record[col]);
    columnTypes.set(col, inferSQLType(col, values));
  });

  // Generate CREATE TABLE statement
  const createTableLines = [`CREATE TABLE ${escapeIdentifier(safeTableName)} (`];
  columns.forEach((col, idx) => {
    const type = columnTypes.get(col) || 'TEXT';
    const comma = idx < columns.length - 1 ? ',' : '';
    createTableLines.push(`  ${escapeIdentifier(col)} ${type}${comma}`);
  });
  createTableLines.push(');');

  const createTableSQL = createTableLines.join('\n');

  // Generate INSERT statements
  const insertStatements: string[] = [];
  
  data.forEach(record => {
    const values = columns.map(col => {
      const value = record[col];
      
      if (value === null || value === undefined) {
        return 'NULL';
      }
      
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          return 'NULL';
        }
        return value.toString();
      }
      
      if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
      }
      
      // String or other - escape single quotes
      const stringValue = String(value).replace(/'/g, "''");
      return `'${stringValue}'`;
    });

    const columnList = columns.map(col => escapeIdentifier(col)).join(', ');
    insertStatements.push(
      `INSERT INTO ${escapeIdentifier(safeTableName)} (${columnList}) VALUES (${values.join(', ')});`
    );
  });

  return `-- SQL Generated: ${new Date().toISOString()}\n-- Table: ${safeTableName}\n-- Records: ${data.length}\n\n${createTableSQL}\n\n${insertStatements.join('\n')}`;
}
