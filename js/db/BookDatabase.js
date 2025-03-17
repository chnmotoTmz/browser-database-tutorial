import { SQLInterface } from './SQLInterface.js';

/**
 * 本管理用データベース
 */
export class BookDatabase {
    constructor() {
        this.sql = new SQLInterface('bookDB');
    }

    /**
     * データベースを初期化
     */
    async initialize() {
        await this.sql.open();
        await this.createTables();
    }

    /**
     * テーブルを作成
     */
    async createTables() {
        await this.sql.execute(`
            CREATE TABLE books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT,
                read_date DATE,
                rating INTEGER CHECK(rating BETWEEN 1 AND 5),
                memo TEXT
            )
        `);
    }

    /**
     * 本を追加
     */
    async addBook(book) {
        const { title, author, read_date, rating, memo } = book;
        return await this.sql.execute(
            'INSERT INTO books (title, author, read_date, rating, memo) VALUES (?, ?, ?, ?, ?)',
            [title, author, read_date, rating, memo]
        );
    }

    /**
     * 本を検索
     */
    async searchBooks(keyword) {
        return await this.sql.execute(
            'SELECT * FROM books WHERE title LIKE ? OR author LIKE ?',
            [`%${keyword}%`, `%${keyword}%`]
        );
    }

    /**
     * 本の一覧を取得
     */
    async getAllBooks(orderBy = 'read_date DESC') {
        return await this.sql.execute(
            `SELECT * FROM books ORDER BY ${orderBy}`
        );
    }

    /**
     * 本を更新
     */
    async updateBook(id, book) {
        const { title, author, read_date, rating, memo } = book;
        return await this.sql.execute(
            'UPDATE books SET title = ?, author = ?, read_date = ?, rating = ?, memo = ? WHERE id = ?',
            [title, author, read_date, rating, memo, id]
        );
    }

    /**
     * 本を削除
     */
    async deleteBook(id) {
        return await this.sql.execute(
            'DELETE FROM books WHERE id = ?',
            [id]
        );
    }

    /**
     * データをJSONとしてエクスポート
     */
    async exportToJSON() {
        const books = await this.getAllBooks();
        return JSON.stringify(books, null, 2);
    }

    /**
     * JSONからデータをインポート
     */
    async importFromJSON(jsonData) {
        const books = JSON.parse(jsonData);
        for (const book of books) {
            await this.addBook(book);
        }
    }
} 