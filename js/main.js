import { BookDatabase } from './db/BookDatabase.js';

class BookApp {
    constructor() {
        this.db = new BookDatabase();
        this.modal = new bootstrap.Modal(document.getElementById('bookModal'));
        this.setupEventListeners();
    }

    async initialize() {
        try {
            await this.db.initialize();
            await this.loadBooks();
        } catch (error) {
            this.showError('データベースの初期化に失敗しました');
            console.error(error);
        }
    }

    setupEventListeners() {
        // 検索機能
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchBooks(e.target.value);
        });

        // 本の追加ボタン
        document.getElementById('addBookBtn').addEventListener('click', () => {
            this.showBookModal();
        });

        // 本の保存
        document.getElementById('saveBookBtn').addEventListener('click', () => {
            this.saveBook();
        });

        // インポート/エクスポート
        document.getElementById('importBtn').addEventListener('click', () => {
            this.importData();
        });
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });
    }

    async loadBooks() {
        try {
            const books = await this.db.getAllBooks();
            this.displayBooks(books);
        } catch (error) {
            this.showError('本の一覧の取得に失敗しました');
            console.error(error);
        }
    }

    async searchBooks(keyword) {
        try {
            const books = keyword 
                ? await this.db.searchBooks(keyword)
                : await this.db.getAllBooks();
            this.displayBooks(books);
        } catch (error) {
            this.showError('検索に失敗しました');
            console.error(error);
        }
    }

    displayBooks(books) {
        const bookList = document.getElementById('bookList');
        bookList.innerHTML = '';

        books.forEach(book => {
            const card = this.createBookCard(book);
            bookList.appendChild(card);
        });
    }

    createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'col';
        card.innerHTML = `
            <div class="card h-100 book-card">
                <div class="card-body">
                    <h5 class="card-title">${this.escapeHtml(book.title)}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${this.escapeHtml(book.author || '著者不明')}</h6>
                    <p class="card-text">
                        ${book.read_date ? `<small class="text-muted">読了日: ${book.read_date}</small><br>` : ''}
                        ${book.rating ? `<span class="rating">${'⭐'.repeat(book.rating)}</span><br>` : ''}
                        ${book.memo ? `<small>${this.escapeHtml(book.memo)}</small>` : ''}
                    </p>
                </div>
                <div class="card-footer bg-transparent border-top-0">
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="app.editBook(${book.id})">
                        <i class="bi bi-pencil"></i> 編集
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="app.deleteBook(${book.id})">
                        <i class="bi bi-trash"></i> 削除
                    </button>
                </div>
            </div>
        `;
        return card;
    }

    showBookModal(book = null) {
        document.getElementById('modalTitle').textContent = book ? '本を編集' : '本を追加';
        document.getElementById('bookId').value = book ? book.id : '';
        document.getElementById('titleInput').value = book ? book.title : '';
        document.getElementById('authorInput').value = book ? book.author : '';
        document.getElementById('readDateInput').value = book ? book.read_date : '';
        document.getElementById('ratingInput').value = book ? book.rating : '';
        document.getElementById('memoInput').value = book ? book.memo : '';
        this.modal.show();
    }

    async saveBook() {
        const bookData = {
            title: document.getElementById('titleInput').value,
            author: document.getElementById('authorInput').value,
            read_date: document.getElementById('readDateInput').value,
            rating: document.getElementById('ratingInput').value,
            memo: document.getElementById('memoInput').value
        };

        const bookId = document.getElementById('bookId').value;

        try {
            if (bookId) {
                await this.db.updateBook(parseInt(bookId), bookData);
            } else {
                await this.db.addBook(bookData);
            }
            this.modal.hide();
            await this.loadBooks();
            this.showSuccess(bookId ? '本を更新しました' : '本を追加しました');
        } catch (error) {
            this.showError('保存に失敗しました');
            console.error(error);
        }
    }

    async editBook(id) {
        try {
            const books = await this.db.searchBooks('');
            const book = books.find(b => b.id === id);
            if (book) {
                this.showBookModal(book);
            }
        } catch (error) {
            this.showError('本の情報の取得に失敗しました');
            console.error(error);
        }
    }

    async deleteBook(id) {
        if (confirm('この本を削除してもよろしいですか？')) {
            try {
                await this.db.deleteBook(id);
                await this.loadBooks();
                this.showSuccess('本を削除しました');
            } catch (error) {
                this.showError('削除に失敗しました');
                console.error(error);
            }
        }
    }

    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                const text = await file.text();
                await this.db.importFromJSON(text);
                await this.loadBooks();
                this.showSuccess('データをインポートしました');
            } catch (error) {
                this.showError('インポートに失敗しました');
                console.error(error);
            }
        };
        input.click();
    }

    async exportData() {
        try {
            const json = await this.db.exportToJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `books_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showSuccess('データをエクスポートしました');
        } catch (error) {
            this.showError('エクスポートに失敗しました');
            console.error(error);
        }
    }

    showSuccess(message) {
        // 成功メッセージの表示（実装は省略）
        alert(message);
    }

    showError(message) {
        // エラーメッセージの表示（実装は省略）
        alert(message);
    }

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// グローバルにアプリケーションインスタンスを作成
window.app = new BookApp();
document.addEventListener('DOMContentLoaded', () => {
    app.initialize();
}); 