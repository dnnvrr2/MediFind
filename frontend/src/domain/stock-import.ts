export const stockFields = [
  { key: 'medicine_id', label: 'Medicine ID', aliases: ['medicineid', 'medifindid', 'id'] },
  { key: 'name', label: 'Medicine name', aliases: ['name', 'medicinename', 'medicine', 'productname', 'product'] },
  { key: 'strength', label: 'Strength', aliases: ['strength', 'dosage'] },
  { key: 'form', label: 'Form', aliases: ['form', 'dosageform'] },
  { key: 'unit', label: 'Unit', aliases: ['unit', 'uom'] },
  { key: 'stock', label: 'Physical stock *', aliases: ['stock', 'physicalstock', 'stockonhand', 'onhand', 'quantity', 'qty'] },
  { key: 'price', label: 'Unit price', aliases: ['price', 'unitprice', 'sellingprice', 'retailprice'] },
  { key: 'low_stock', label: 'Low stock threshold', aliases: ['lowstock', 'lowstockthreshold', 'reorderlevel'] },
  { key: 'available', label: 'Available for sale', aliases: ['available', 'availableforsale', 'enabled'] },
] as const;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export function suggestStockMapping(headers: string[], saved: Record<string, string>) {
  const result: Record<string, string> = {};
  const used = new Set<string>();
  for (const field of stockFields) {
    const preferred = saved[field.key];
    if (preferred && headers.includes(preferred) && !used.has(preferred)) { result[field.key] = preferred; used.add(preferred); }
  }
  for (const field of stockFields) {
    if (result[field.key]) continue;
    const match = headers.find(header => !used.has(header) && (field.aliases as readonly string[]).includes(normalize(header)));
    if (match) { result[field.key] = match; used.add(match); }
  }
  return result;
}
