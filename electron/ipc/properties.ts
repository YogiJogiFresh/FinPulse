import { ipcMain } from 'electron';
import { getDatabase, saveDatabase, generateId, query } from '../database';

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function formatRow(row: any): any {
  const obj: any = {};
  for (const key of Object.keys(row)) {
    obj[snakeToCamel(key)] = row[key];
  }
  if (obj.id !== undefined) obj._id = obj.id;
  return obj;
}

export function registerPropertyHandlers(): void {
  // ── Properties CRUD ──

  ipcMain.handle('properties:getAll', () => {
    return query('SELECT * FROM properties ORDER BY name').map(formatRow);
  });

  ipcMain.handle('properties:create', (_event, data: {
    name: string; designation: string; address?: string;
    purchaseDate?: string; purchasePrice?: number; notes?: string
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      `INSERT INTO properties (id, name, designation, address, purchase_date, purchase_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.designation, data.address || '', data.purchaseDate || '', data.purchasePrice || 0, data.notes || '']
    );
    saveDatabase();
    return formatRow(query('SELECT * FROM properties WHERE id = ?', [id])[0]);
  });

  ipcMain.handle('properties:update', (_event, data: any) => {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    const allowed = { name: 'name', designation: 'designation', address: 'address', purchaseDate: 'purchase_date', purchasePrice: 'purchase_price', notes: 'notes' };
    for (const [camel, snake] of Object.entries(allowed)) {
      if (data[camel] !== undefined) {
        fields.push(`${snake} = ?`);
        values.push(data[camel]);
      }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(data.id || data._id);
    db.run(`UPDATE properties SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return formatRow(query('SELECT * FROM properties WHERE id = ?', [data.id || data._id])[0]);
  });

  ipcMain.handle('properties:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM properties WHERE id = ?', [data.id]);
    saveDatabase();
  });

  // ── Property Details CRUD ──

  ipcMain.handle('propertyDetails:getAll', (_event, propertyId: string) => {
    return query('SELECT * FROM property_details WHERE property_id = ? ORDER BY category, label', [propertyId]).map(formatRow);
  });

  ipcMain.handle('propertyDetails:create', (_event, data: {
    propertyId: string; label: string; value?: string; category?: string
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO property_details (id, property_id, label, value, category) VALUES (?, ?, ?, ?, ?)',
      [id, data.propertyId, data.label, data.value || '', data.category || 'other']
    );
    saveDatabase();
    return formatRow(query('SELECT * FROM property_details WHERE id = ?', [id])[0]);
  });

  ipcMain.handle('propertyDetails:update', (_event, data: any) => {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [camel, snake] of Object.entries({ label: 'label', value: 'value', category: 'category' })) {
      if (data[camel] !== undefined) {
        fields.push(`${snake} = ?`);
        values.push(data[camel]);
      }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(data.id || data._id);
    db.run(`UPDATE property_details SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return formatRow(query('SELECT * FROM property_details WHERE id = ?', [data.id || data._id])[0]);
  });

  ipcMain.handle('propertyDetails:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM property_details WHERE id = ?', [data.id]);
    saveDatabase();
  });

  // ── Property Expenses CRUD ──

  ipcMain.handle('propertyExpenses:getAll', (_event, propertyId: string) => {
    return query('SELECT * FROM property_expenses WHERE property_id = ? ORDER BY date DESC', [propertyId]).map(formatRow);
  });

  ipcMain.handle('propertyExpenses:create', (_event, data: {
    propertyId: string; date: string; description: string;
    amount: number; category?: string; notes?: string;
    recurring?: string; recurringEndDate?: string
  }) => {
    const db = getDatabase();
    const category = data.category || 'other';
    const notes = data.notes || '';
    const recurring = data.recurring || '';
    const recurringEndDate = data.recurringEndDate || '';

    // Generate dates for recurring entries
    const dates: string[] = [data.date || ''];
    if (recurring && data.date) {
      const [sm, sd, sy] = data.date.split('/').map(Number);
      let endDate: Date;
      if (recurringEndDate) {
        const [em, ed, ey] = recurringEndDate.split('/').map(Number);
        endDate = new Date(ey, em - 1, ed);
      } else {
        endDate = new Date(sy + 5, sm - 1, sd);
      }
      let cur = new Date(sy, sm - 1, sd);
      while (true) {
        if (recurring === 'monthly') {
          cur = new Date(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
        } else if (recurring === 'quarterly') {
          cur = new Date(cur.getFullYear(), cur.getMonth() + 3, cur.getDate());
        } else {
          cur = new Date(cur.getFullYear() + 1, cur.getMonth(), cur.getDate());
        }
        if (cur > endDate) break;
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        dates.push(`${mm}/${dd}/${cur.getFullYear()}`);
      }
    }

    let firstId = '';
    for (const dt of dates) {
      const id = generateId();
      if (!firstId) firstId = id;
      db.run(
        'INSERT INTO property_expenses (id, property_id, date, description, amount, category, notes, recurring, recurring_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, data.propertyId, dt, data.description, data.amount, category, notes, recurring, recurringEndDate]
      );
    }
    saveDatabase();
    return formatRow(query('SELECT * FROM property_expenses WHERE id = ?', [firstId])[0]);
  });

  ipcMain.handle('propertyExpenses:update', (_event, data: any) => {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [camel, snake] of Object.entries({ date: 'date', description: 'description', amount: 'amount', category: 'category', notes: 'notes', recurring: 'recurring', recurringEndDate: 'recurring_end_date' })) {
      if (data[camel] !== undefined) {
        fields.push(`${snake} = ?`);
        values.push(data[camel]);
      }
    }
    if (fields.length === 0) return;
    values.push(data.id || data._id);
    db.run(`UPDATE property_expenses SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return formatRow(query('SELECT * FROM property_expenses WHERE id = ?', [data.id || data._id])[0]);
  });

  ipcMain.handle('propertyExpenses:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM property_expenses WHERE id = ?', [data.id]);
    saveDatabase();
  });

  // ── Property Contractors CRUD ──

  ipcMain.handle('propertyContractors:getAll', (_event, propertyId: string) => {
    return query('SELECT * FROM property_contractors WHERE property_id = ? ORDER BY name', [propertyId]).map(formatRow);
  });

  ipcMain.handle('propertyContractors:create', (_event, data: {
    propertyId: string; name: string; specialty?: string;
    phone?: string; email?: string; notes?: string
  }) => {
    const db = getDatabase();
    const id = generateId();
    db.run(
      'INSERT INTO property_contractors (id, property_id, name, specialty, phone, email, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.propertyId, data.name, data.specialty || 'other', data.phone || '', data.email || '', data.notes || '']
    );
    saveDatabase();
    return formatRow(query('SELECT * FROM property_contractors WHERE id = ?', [id])[0]);
  });

  ipcMain.handle('propertyContractors:update', (_event, data: any) => {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [camel, snake] of Object.entries({ name: 'name', specialty: 'specialty', phone: 'phone', email: 'email', notes: 'notes' })) {
      if (data[camel] !== undefined) {
        fields.push(`${snake} = ?`);
        values.push(data[camel]);
      }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(data.id || data._id);
    db.run(`UPDATE property_contractors SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    return formatRow(query('SELECT * FROM property_contractors WHERE id = ?', [data.id || data._id])[0]);
  });

  ipcMain.handle('propertyContractors:delete', (_event, data: { id: string }) => {
    const db = getDatabase();
    db.run('DELETE FROM property_contractors WHERE id = ?', [data.id]);
    saveDatabase();
  });
}
