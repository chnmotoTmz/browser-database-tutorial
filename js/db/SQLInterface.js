/**
 * SQLライクなインターフェースを提供するIndexedDBラッパー
 */
export class SQLInterface {
    constructor(dbName = 'bookDB') {
        this.dbName = dbName;
        this.db = null;
        this.version = 1;
        this.tables = new Map();
    }

    /**
     * データベースを開く
     */
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(new Error('データベースを開けませんでした'));
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('データベースに接続しました');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('データベースを新規作成します');
                // テーブル情報を保存するためのオブジェクトストア
                if (!db.objectStoreNames.contains('_tables')) {
                    db.createObjectStore('_tables', { keyPath: 'name' });
                }
            };
        });
    }

    /**
     * SQLクエリを実行
     */
    async execute(sql, params = []) {
        const parsed = this._parseSQL(sql.trim());
        console.log('実行するSQL:', sql);
        console.log('パラメータ:', params);

        try {
            switch (parsed.type) {
                case 'CREATE':
                    return await this._handleCreate(parsed);
                case 'INSERT':
                    return await this._handleInsert(parsed, params);
                case 'SELECT':
                    return await this._handleSelect(parsed, params);
                case 'UPDATE':
                    return await this._handleUpdate(parsed, params);
                case 'DELETE':
                    return await this._handleDelete(parsed, params);
                default:
                    throw new Error(`未対応のSQL文です: ${parsed.type}`);
            }
        } catch (error) {
            console.error('SQLエラー:', error);
            throw error;
        }
    }

    /**
     * CREATE TABLE文の処理
     */
    async _handleCreate(parsed) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['_tables'], 'readwrite');
            const tableStore = transaction.objectStore('_tables');

            // テーブル情報を保存
            tableStore.put({
                name: parsed.table,
                columns: parsed.columns,
                created: new Date()
            });

            // テーブルのオブジェクトストアを作成
            if (!this.db.objectStoreNames.contains(parsed.table)) {
                const store = this.db.createObjectStore(parsed.table, {
                    keyPath: 'id',
                    autoIncrement: true
                });

                // インデックスを作成
                parsed.columns.forEach(col => {
                    if (col.name !== 'id') {
                        store.createIndex(col.name, col.name, { unique: false });
                    }
                });
            }

            transaction.oncomplete = () => {
                console.log(`テーブル ${parsed.table} を作成しました`);
                resolve();
            };
            transaction.onerror = () => reject(new Error('テーブルの作成に失敗しました'));
        });
    }

    /**
     * INSERT文の処理
     */
    async _handleInsert(parsed, params) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([parsed.table], 'readwrite');
            const store = transaction.objectStore(parsed.table);

            const data = {};
            parsed.columns.forEach((col, i) => {
                data[col] = params[i];
            });
            data.created_at = new Date();

            const request = store.add(data);
            request.onsuccess = () => {
                console.log('データを挿入しました:', data);
                resolve(request.result);
            };
            request.onerror = () => reject(new Error('データの挿入に失敗しました'));
        });
    }

    /**
     * SELECT文の処理
     */
    async _handleSelect(parsed, params) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([parsed.table], 'readonly');
            const store = transaction.objectStore(parsed.table);
            const request = store.getAll();

            request.onsuccess = () => {
                let results = request.result;

                // WHERE句の処理
                if (parsed.where) {
                    results = this._filterByCondition(results, parsed.where, params);
                }

                // ORDER BY句の処理
                if (parsed.orderBy) {
                    results = this._sortResults(results, parsed.orderBy);
                }

                console.log('検索結果:', results);
                resolve(results);
            };
            request.onerror = () => reject(new Error('検索に失敗しました'));
        });
    }

    /**
     * UPDATE文の処理
     */
    async _handleUpdate(parsed, params) {
        const records = await this._handleSelect(parsed, params);
        const transaction = this.db.transaction([parsed.table], 'readwrite');
        const store = transaction.objectStore(parsed.table);

        const updates = records.map(record => {
            return new Promise((resolve, reject) => {
                const updatedData = { ...record, ...parsed.set };
                updatedData.updated_at = new Date();

                const request = store.put(updatedData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error('更新に失敗しました'));
            });
        });

        return Promise.all(updates);
    }

    /**
     * DELETE文の処理
     */
    async _handleDelete(parsed, params) {
        const records = await this._handleSelect(parsed, params);
        const transaction = this.db.transaction([parsed.table], 'readwrite');
        const store = transaction.objectStore(parsed.table);

        const deletes = records.map(record => {
            return new Promise((resolve, reject) => {
                const request = store.delete(record.id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error('削除に失敗しました'));
            });
        });

        return Promise.all(deletes);
    }

    /**
     * SQLクエリをパースする
     */
    _parseSQL(sql) {
        const normalized = sql.toUpperCase();
        
        if (normalized.startsWith('CREATE TABLE')) {
            return this._parseCreateTable(sql);
        } else if (normalized.startsWith('INSERT INTO')) {
            return this._parseInsert(sql);
        } else if (normalized.startsWith('SELECT')) {
            return this._parseSelect(sql);
        } else if (normalized.startsWith('UPDATE')) {
            return this._parseUpdate(sql);
        } else if (normalized.startsWith('DELETE')) {
            return this._parseDelete(sql);
        }
        
        throw new Error('未対応のSQL文です');
    }

    /**
     * CREATE TABLE文をパースする
     */
    _parseCreateTable(sql) {
        const match = sql.match(/CREATE TABLE (\w+) \(([\s\S]+)\)/i);
        if (!match) throw new Error('CREATE TABLE文の構文が不正です');

        const [_, table, columnDefs] = match;
        const columns = columnDefs
            .split(',')
            .map(col => col.trim())
            .map(col => {
                const [name, ...type] = col.split(' ');
                return { name, type: type.join(' ') };
            });

        return { type: 'CREATE', table, columns };
    }

    /**
     * INSERT文をパースする
     */
    _parseInsert(sql) {
        const match = sql.match(/INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)/i);
        if (!match) throw new Error('INSERT文の構文が不正です');

        const [_, table, columns, values] = match;
        return {
            type: 'INSERT',
            table,
            columns: columns.split(',').map(c => c.trim()),
            values: values.split(',').map(v => v.trim())
        };
    }

    /**
     * SELECT文をパースする
     */
    _parseSelect(sql) {
        const parts = sql.match(/SELECT (.*?) FROM (\w+)(?:\s+WHERE\s+([^ORDER]*))?(?:\s+ORDER BY\s+(.*))?/i);
        if (!parts) throw new Error('SELECT文の構文が不正です');

        const [_, columns, table, where, orderBy] = parts;
        return {
            type: 'SELECT',
            columns: columns.split(',').map(c => c.trim()),
            table,
            where: where ? this._parseWhere(where.trim()) : null,
            orderBy: orderBy ? this._parseOrderBy(orderBy.trim()) : null
        };
    }

    /**
     * WHERE句をパースする
     */
    _parseWhere(where) {
        // 簡易的なWHERE句のパース
        const conditions = where.split('AND').map(cond => {
            const [column, operator, value] = cond.trim().split(/\s+/);
            return { column, operator, value };
        });
        return conditions;
    }

    /**
     * ORDER BY句をパースする
     */
    _parseOrderBy(orderBy) {
        const [column, direction = 'ASC'] = orderBy.split(/\s+/);
        return { column, direction };
    }

    /**
     * 条件に基づいてフィルタリング
     */
    _filterByCondition(results, conditions, params) {
        return results.filter(record => {
            return conditions.every((condition, index) => {
                const value = params[index];
                const recordValue = record[condition.column];

                switch (condition.operator) {
                    case '=':
                        return recordValue === value;
                    case 'LIKE':
                        return recordValue.includes(value.replace(/%/g, ''));
                    case '>':
                        return recordValue > value;
                    case '<':
                        return recordValue < value;
                    default:
                        return false;
                }
            });
        });
    }

    /**
     * 結果をソート
     */
    _sortResults(results, orderBy) {
        return [...results].sort((a, b) => {
            const aVal = a[orderBy.column];
            const bVal = b[orderBy.column];
            const direction = orderBy.direction === 'DESC' ? -1 : 1;

            if (aVal < bVal) return -1 * direction;
            if (aVal > bVal) return 1 * direction;
            return 0;
        });
    }
} 