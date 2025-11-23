export interface ParsedJSON {
  data: Record<string, any>[];
  maxNestingLevel: number;
  objectCount: number;
}

export function parseAndFlattenJSON(jsonString: string): ParsedJSON {
  const parsed = JSON.parse(jsonString);
  let maxNestingLevel = 0;

  function getNestingLevel(obj: any, currentLevel: number = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentLevel;
    }

    let maxLevel = currentLevel;
    for (const value of Object.values(obj)) {
      const level = getNestingLevel(value, currentLevel + 1);
      maxLevel = Math.max(maxLevel, level);
    }
    return maxLevel;
  }

  /**
   * Recursively explode nested arrays while preserving parent context
   * Returns an array of flattened records
   */
  function explodeObject(obj: any, prefix: string = '', parentContext: Record<string, any> = {}, sourcePath: string = '', arrayLevel: number = 0): Record<string, any>[] {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return [{ ...parentContext, [prefix || 'value']: null }];
    }

    // Handle primitives
    if (typeof obj !== 'object') {
      return [{ ...parentContext, [prefix || 'value']: obj }];
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return [{ ...parentContext, [prefix]: null }];
      }

      // Check if all primitives
      const allPrimitives = obj.every(item => 
        item === null || 
        item === undefined || 
        typeof item === 'string' || 
        typeof item === 'number' || 
        typeof item === 'boolean'
      );

      if (allPrimitives) {
        // Join primitives as comma-separated string
        return [{ ...parentContext, [prefix]: obj.filter(x => x !== null && x !== undefined).join(', ') }];
      }

      // Array contains objects - explode each item
      const allRecords: Record<string, any>[] = [];
      obj.forEach((item, idx) => {
        const newSourcePath = sourcePath || prefix || 'root';
        // Use unique index key per array level to avoid overwriting parent indices
        const indexKey = prefix ? `${prefix}_index` : `_index_level_${arrayLevel}`;
        const itemRecords = explodeObject(item, prefix, { ...parentContext, [indexKey]: idx }, newSourcePath, arrayLevel + 1);
        allRecords.push(...itemRecords);
      });

      return allRecords.length > 0 ? allRecords : [parentContext];
    }

    // Handle regular objects
    const baseContext: Record<string, any> = { ...parentContext };
    const nestedExplosions: Record<string, any>[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;

      if (value === null || value === undefined) {
        baseContext[fullKey] = null;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        // Primitive value - add to base context
        baseContext[fullKey] = value;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          baseContext[fullKey] = null;
        } else {
          const allPrimitives = value.every(item => 
            item === null || 
            item === undefined || 
            typeof item === 'string' || 
            typeof item === 'number' || 
            typeof item === 'boolean'
          );

          if (allPrimitives) {
            baseContext[fullKey] = value.filter(x => x !== null && x !== undefined).join(', ');
          } else {
            // Object array - explode it and APPEND to results (UNION, not Cartesian product)
            const newSourcePath = sourcePath || fullKey;
            const arrayRecords = explodeObject(value, fullKey, baseContext, newSourcePath, arrayLevel + 1);
            nestedExplosions.push(...arrayRecords);
          }
        }
      } else if (typeof value === 'object') {
        // Nested object - recursively explode it
        const nestedRecords = explodeObject(value, fullKey, baseContext, sourcePath, arrayLevel);
        
        // If recursion returned multiple records, append them (UNION)
        // Otherwise, merge the single record's fields into baseContext
        if (nestedRecords.length > 1) {
          nestedExplosions.push(...nestedRecords);
        } else if (nestedRecords.length === 1) {
          // Single record - merge its fields into baseContext
          const singleRecord = nestedRecords[0];
          for (const [recKey, recValue] of Object.entries(singleRecord)) {
            // Skip inherited parent context fields
            if (!Object.prototype.hasOwnProperty.call(baseContext, recKey)) {
              baseContext[recKey] = recValue;
            }
          }
        }
      }
    }

    // If we found nested explosions, return them (UNION of all arrays)
    // Merge baseContext into every record to preserve all non-array fields
    if (nestedExplosions.length > 0) {
      return nestedExplosions.map(rec => ({ ...baseContext, ...rec }));
    }

    // No nested explosions - return base context
    return [baseContext];
  }

  maxNestingLevel = getNestingLevel(parsed);
  const records = explodeObject(parsed);

  return {
    data: records,
    maxNestingLevel,
    objectCount: records.length
  };
}
