export class DataService {
    constructor(apiService) {
        this.apiService = apiService;
        this.books = [];
        this.filteredBooks = [];
        this.currentPage = 1;
        this.booksPerPage = 12;
        this.totalResults = 0;
        this.lastSearchQuery = '';
        this.lastSearchOptions = {};
    }

    async loadInitialBooks() {
        try {
            // Загружаем книги по популярным жанрам
            const genres = await this.apiService.getPopularGenres();
            const booksByGenre = await Promise.all(
                genres.map(genre => 
                    this.apiService.getPopularBooksBySubject(genre, 5)
                )
            );
            
            this.books = booksByGenre.flat();
            this.filteredBooks = [...this.books];
            this.totalResults = this.books.length;
            
            return {
                books: this.filteredBooks,
                genres: this.extractUniqueGenres(this.books)
            };
        } catch (error) {
            console.error('Ошибка загрузки начальных книг:', error);
            throw error;
        }
    }

    async searchBooks(query, options = {}, page = 1) {
        try {
            this.lastSearchQuery = query;
            this.lastSearchOptions = options;
            this.currentPage = page;
            
            const result = await this.apiService.searchBooks(query, {
                ...options,
                page,
                limit: this.booksPerPage
            });
            
            this.books = result;
            this.filteredBooks = [...this.books];
            this.totalResults = result.length; // В реальном API будет общее количество
            
            return {
                books: this.filteredBooks,
                genres: this.extractUniqueGenres(this.books),
                authors: this.extractUniqueAuthors(this.books)
            };
        } catch (error) {
            console.error('Ошибка поиска книг:', error);
            throw error;
        }
    }

    applyFilters(filters) {
        this.filteredBooks = [...this.books];
        
        // Фильтрация по жанрам
        if (filters.genres && filters.genres.length > 0) {
            this.filteredBooks = this.filteredBooks.filter(book => 
                filters.genres.some(genre => 
                    book.subjects?.includes(genre) || 
                    book.genre?.includes(genre)
                )
            );
        }
        
        // Фильтрация по авторам
        if (filters.authors && filters.authors.length > 0) {
            this.filteredBooks = this.filteredBooks.filter(book => 
                filters.authors.some(author => 
                    book.author.toLowerCase().includes(author.toLowerCase())
                )
            );
        }
        
        // Фильтрация по году издания
        if (filters.yearFrom || filters.yearTo) {
            const yearFrom = filters.yearFrom || 0;
            const yearTo = filters.yearTo || new Date().getFullYear();
            
            this.filteredBooks = this.filteredBooks.filter(book => 
                book.year && book.year >= yearFrom && book.year <= yearTo
            );
        }
        
        // Фильтрация по количеству страниц
        if (filters.pages) {
            switch (filters.pages) {
                case '0-100':
                    this.filteredBooks = this.filteredBooks.filter(book => 
                        book.pages && book.pages <= 100
                    );
                    break;
                case '100-300':
                    this.filteredBooks = this.filteredBooks.filter(book => 
                        book.pages && book.pages > 100 && book.pages <= 300
                    );
                    break;
                case '300-500':
                    this.filteredBooks = this.filteredBooks.filter(book => 
                        book.pages && book.pages > 300 && book.pages <= 500
                    );
                    break;
                case '500+':
                    this.filteredBooks = this.filteredBooks.filter(book => 
                        book.pages && book.pages > 500
                    );
                    break;
            }
        }
        
        // Фильтрация по языку
        if (filters.language && filters.language !== 'any') {
            this.filteredBooks = this.filteredBooks.filter(book => 
                book.language === filters.language
            );
        }
        
        // Фильтрация по дополнительным параметрам
        if (filters.bestsellersOnly) {
            // В реальном приложении нужно определить критерий бестселлера
            this.filteredBooks = this.filteredBooks.filter(book => 
                book.rating_count > 100 // Примерный критерий
            );
        }
        
        if (filters.withCoversOnly) {
            this.filteredBooks = this.filteredBooks.filter(book => 
                book.cover !== null
            );
        }
        
        // Поиск по названию
        if (filters.searchQuery) {
            const searchTerm = filters.searchQuery.toLowerCase();
            this.filteredBooks = this.filteredBooks.filter(book => 
                book.title.toLowerCase().includes(searchTerm) ||
                (book.author && book.author.toLowerCase().includes(searchTerm))
            );
        }
        
        // Сортировка
        this.sortBooks(filters.sortOption);
        
        // Обновление общего количества результатов
        this.totalResults = this.filteredBooks.length;
        
        return this.getPaginatedBooks();
    }

    sortBooks(sortOption) {
        switch(sortOption) {
            case 'title-asc':
                this.filteredBooks.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title-desc':
                this.filteredBooks.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'author-asc':
                this.filteredBooks.sort((a, b) => a.author.localeCompare(b.author));
                break;
            case 'author-desc':
                this.filteredBooks.sort((a, b) => b.author.localeCompare(a.author));
                break;
            case 'year-asc':
                this.filteredBooks.sort((a, b) => (a.year || 0) - (b.year || 0));
                break;
            case 'year-desc':
                this.filteredBooks.sort((a, b) => (b.year || 0) - (a.year || 0));
                break;
            case 'pages-asc':
                this.filteredBooks.sort((a, b) => (a.pages || 0) - (b.pages || 0));
                break;
            case 'pages-desc':
                this.filteredBooks.sort((a, b) => (b.pages || 0) - (a.pages || 0));
                break;
            case 'relevance':
            default:
                // Сортировка по релевантности (если был поиск)
                if (this.lastSearchQuery) {
                    const query = this.lastSearchQuery.toLowerCase();
                    this.filteredBooks.sort((a, b) => {
                        const aTitleMatch = a.title.toLowerCase().includes(query);
                        const bTitleMatch = b.title.toLowerCase().includes(query);
                        
                        if (aTitleMatch && !bTitleMatch) return -1;
                        if (!aTitleMatch && bTitleMatch) return 1;
                        
                        const aAuthorMatch = a.author?.toLowerCase().includes(query) || false;
                        const bAuthorMatch = b.author?.toLowerCase().includes(query) || false;
                        
                        if (aAuthorMatch && !bAuthorMatch) return -1;
                        if (!aAuthorMatch && bAuthorMatch) return 1;
                        
                        return 0;
                    });
                }
                break;
        }
    }

    getPaginatedBooks() {
        const startIndex = (this.currentPage - 1) * this.booksPerPage;
        const endIndex = startIndex + this.booksPerPage;
        return {
            books: this.filteredBooks.slice(startIndex, endIndex),
            totalPages: Math.ceil(this.totalResults / this.booksPerPage),
            totalResults: this.totalResults
        };
    }

    goToPage(page) {
        if (page < 1 || page > Math.ceil(this.totalResults / this.booksPerPage)) {
            return null;
        }
        
        this.currentPage = page;
        return this.getPaginatedBooks();
    }

    extractUniqueGenres(books) {
        const genres = new Set();
        
        books.forEach(book => {
            if (book.subjects) {
                book.subjects.forEach(genre => genres.add(genre));
            }
            if (book.genre) {
                book.genre.split(',').forEach(g => genres.add(g.trim()));
            }
        });
        
        return Array.from(genres).sort();
    }

    extractUniqueAuthors(books) {
        const authors = new Set();
        
        books.forEach(book => {
            if (book.author) {
                authors.add(book.author);
            }
        });
        
        return Array.from(authors).sort((a, b) => a.localeCompare(b));
    }

    getStats() {
        if (this.filteredBooks.length === 0) return null;
        
        const totalBooks = this.filteredBooks.length;
        const totalPages = this.filteredBooks.reduce(
            (sum, book) => sum + (book.pages || 0), 0
        );
        const averagePages = Math.round(totalPages / totalBooks);
        
        const genres = {};
        this.filteredBooks.forEach(book => {
            if (book.subjects) {
                book.subjects.forEach(genre => {
                    genres[genre] = (genres[genre] || 0) + 1;
                });
            } else if (book.genre) {
                book.genre.split(',').forEach(g => {
                    const genre = g.trim();
                    if (genre) {
                        genres[genre] = (genres[genre] || 0) + 1;
                    }
                });
            }
        });
        
        return {
            totalBooks,
            totalPages,
            averagePages,
            genres
        };
    }
}
