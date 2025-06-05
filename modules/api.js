export class ApiService {
    constructor() {
        this.baseUrl = 'https://openlibrary.org';
        this.coversUrl = 'https://covers.openlibrary.org/b';
        this.cache = new Map();
        this.popularSubjects = [
            'fiction', 'science_fiction', 'fantasy', 'mystery', 'romance',
            'history', 'biography', 'science', 'technology', 'art'
        ];
    }

    async searchBooks(query, options = {}) {
        const cacheKey = `search:${JSON.stringify({query, options})}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            let url = `${this.baseUrl}/search.json?q=${encodeURIComponent(query)}`;
            
            if (options.title) url += `&title=${encodeURIComponent(options.title)}`;
            if (options.author) url += `&author=${encodeURIComponent(options.author)}`;
            if (options.publisher) url += `&publisher=${encodeURIComponent(options.publisher)}`;
            if (options.isbn) url += `&isbn=${encodeURIComponent(options.isbn)}`;
            if (options.language) url += `&language=${encodeURIComponent(options.language)}`;
            if (options.year_from || options.year_to) {
                const publishYear = [];
                if (options.year_from) publishYear.push(`publish_year>=${options.year_from}`);
                if (options.year_to) publishYear.push(`publish_year<=${options.year_to}`);
                url += `&${publishYear.join('+AND+')}`;
            }
            
            if (options.limit) url += `&limit=${options.limit}`;
            if (options.page) url += `&page=${options.page}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.docs || data.docs.length === 0) {
                throw new Error('Книги не найдены');
            }
            
            const books = await this.enrichBooksData(data.docs);
            this.cache.set(cacheKey, books);
            return books;
        } catch (error) {
            console.error('Ошибка поиска книг:', error);
            throw error;
        }
    }

    async getPopularBooksBySubject(subject, limit = 20) {
        const cacheKey = `subject:${subject}:${limit}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/subjects/${subject}.json?limit=${limit}`
            );
            const data = await response.json();
            
            if (!data.works || data.works.length === 0) {
                throw new Error(`Не найдено книг по теме ${subject}`);
            }
            
            const books = await this.enrichBooksData(data.works.map(work => ({
                key: work.key,
                title: work.title,
                author_name: work.authors?.map(a => a.name),
                first_publish_year: work.first_publish_year,
                cover_id: work.cover_id,
                subject: [subject]
            })));
            
            this.cache.set(cacheKey, books);
            return books;
        } catch (error) {
            console.error(`Ошибка загрузки книг по теме ${subject}:`, error);
            throw error;
        }
    }

    async getBookDetails(bookId) {
        const cacheKey = `book:${bookId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseUrl}/works/${bookId}.json`);
            const data = await response.json();
            
            const bookDetails = {
                description: data.description?.value || data.description || null,
                pages: data.number_of_pages || null,
                subjects: data.subjects || [],
                language: this.detectLanguage(data),
                isbn: this.extractIsbn(data)
            };
            
            this.cache.set(cacheKey, bookDetails);
            return bookDetails;
        } catch (error) {
            console.error(`Ошибка загрузки деталей книги ${bookId}:`, error);
            return null;
        }
    }

    async getAuthorDetails(authorId) {
        if (!authorId) return null;
        
        const cacheKey = `author:${authorId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseUrl}/authors/${authorId}.json`);
            const data = await response.json();
            
            const authorDetails = {
                name: data.name,
                bio: data.bio?.value || data.bio || null,
                birth_date: data.birth_date || null,
                death_date: data.death_date || null
            };
            
            this.cache.set(cacheKey, authorDetails);
            return authorDetails;
        } catch (error) {
            console.error(`Ошибка загрузки автора ${authorId}:`, error);
            return null;
        }
    }

    async enrichBooksData(booksData) {
        const enrichedBooks = [];
        
        for (const book of booksData) {
            try {
                const bookId = book.key?.replace('/works/', '') || null;
                const authorId = book.author_key?.[0] || null;
                
                const [bookDetails, authorDetails] = await Promise.all([
                    bookId ? this.getBookDetails(bookId) : Promise.resolve(null),
                    authorId ? this.getAuthorDetails(authorId) : Promise.resolve(null)
                ]);
                
                const enrichedBook = {
                    id: bookId,
                    title: book.title || 'Без названия',
                    author: book.author_name?.join(', ') || authorDetails?.name || 'Неизвестный автор',
                    year: book.first_publish_year || book.publish_year?.[0] || null,
                    pages: bookDetails?.pages || null,
                    genre: book.subject?.join(', ') || bookDetails?.subjects?.join(', ') || null,
                    language: bookDetails?.language || this.detectLanguage(book),
                    description: bookDetails?.description || null,
                    cover: book.cover_id ? `${this.coversUrl}/id/${book.cover_id}-M.jpg` : null,
                    isbn: bookDetails?.isbn || book.isbn?.[0] || null,
                    publisher: book.publisher?.[0] || null,
                    authorDetails: authorDetails || null,
                    subjects: book.subject || bookDetails?.subjects || []
                };
                
                enrichedBooks.push(enrichedBook);
            } catch (error) {
                console.error('Ошибка обогащения данных книги:', error);
            }
        }
        
        return enrichedBooks;
    }

    detectLanguage(bookData) {
        if (bookData.language) {
            return Array.isArray(bookData.language) 
                ? bookData.language[0] 
                : bookData.language;
        }
        
        if (bookData.languages) {
            const langKey = bookData.languages[0]?.key;
            if (langKey) {
                return langKey.split('/')[2];
            }
        }
        
        return null;
    }

    extractIsbn(bookData) {
        if (bookData.isbn) {
            return Array.isArray(bookData.isbn) 
                ? bookData.isbn[0] 
                : bookData.isbn;
        }
        
        if (bookData.identifiers?.isbn) {
            return Array.isArray(bookData.identifiers.isbn)
                ? bookData.identifiers.isbn[0]
                : bookData.identifiers.isbn;
        }
        
        return null;
    }

    async getPopularGenres(limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/subjects.json?limit=${limit}`);
            const data = await response.json();
            return data.works?.map(work => work.key.replace('/subjects/', '')) || [];
        } catch (error) {
            console.error('Ошибка загрузки популярных жанров:', error);
            return this.popularSubjects.slice(0, limit);
        }
    }
}
