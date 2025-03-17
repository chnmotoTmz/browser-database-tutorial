// script.js

class Record {
  constructor(id, field1, field2, field3) {
    this.id = id;
    this.field1 = field1;
    this.field2 = field2;
    this.field3 = field3;
  }
}

class DatabaseManager {
  db;

  constructor() {
    this.db = null;
  }

  async openDatabase() {
    try {
      const request = indexedDB.open('myDatabase', 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
          store.createIndex('field1', 'field1', { unique: false }); // Add index for searching
          store.createIndex('field2', 'field2', { unique: false });
        }
      };

      this.db = (await request).result;
      return this.db;
    } catch (error) {
      console.error('Error opening database:', error);
      throw error; // Re-throw the error for handling in the calling function
    }
  }

  async addRecord(record) {
    if (!this.db) {
        throw new Error("Database not opened.");
    }
    const tx = this.db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    await store.add(record);
    return true;
  }

  async getRecords() {
    if (!this.db) {
        throw new Error("Database not opened.");
    }
    const tx = this.db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const records = [];
    const allRecords = await store.getAll();
    for (const record of allRecords) {
      records.push(new Record(record.id, record.field1, record.field2, record.field3));
    }
    return records;
  }

  async updateRecord(recordId, updatedRecord) {
    if (!this.db) {
        throw new Error("Database not opened.");
    }
    const tx = this.db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    const request = store.get(recordId);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const existingRecord = request.result;
            if (existingRecord) {
                const updatedRecordData = { ...existingRecord, ...updatedRecord };
                store.put(updatedRecordData);
                resolve(true);
            } else {
                reject(new Error(`Record with ID ${recordId} not found`));
            }
        };
        request.onerror = () => reject(request.error);
    });
  }

  async deleteRecord(recordId) {
    if (!this.db) {
        throw new Error("Database not opened.");
    }
    const tx = this.db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    const request = store.delete(recordId);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
  }

  async searchRecords(query) {
    if (!this.db) {
        throw new Error("Database not opened.");
    }
    const tx = this.db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const index = store.index('field1'); // Use the appropriate index
    const records = [];
    const request = index.getAll(query);
    request.onsuccess = () => {
      for (const record of request.result) {
        records.push(new Record(record.id, record.field1, record.field2, record.field3));
      }
    };
    await new Promise(resolve => request.onsuccess = resolve);
    return records;
  }
}

// Example usage (replace with your UI handling)
async function init() {
  const dbManager = new DatabaseManager();
  try {
    await dbManager.openDatabase();
    // ... your UI initialization and event handling ...
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
}

init();
