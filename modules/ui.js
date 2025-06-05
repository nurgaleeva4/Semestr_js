export class UI {
    constructor(dataService, storage) {
        this.dataService = dataService;
        this.storage = storage;
        this.initializeDOMElements();
        this.currentGenres = [];
        this.currentAuthors = [];
        this.visibleGenresCount = 10;
    }

    initializeDOMElements() {
        // Элементы приветственного экрана
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.mainScreen = document.getElementById('main-screen');
        this.usernameInput = document.getElementById('username');
        this.startButton = document.getElementById('start-btn');
        this.userNameElement = document.getElementById('user-name');

        // Элементы поиска и фильтров
        this.searchInput = document.getElementById('search-input');
        this.advancedSearchBtn = document.getElementById('advanced-search-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.applyFiltersBtn = document.getElementById('apply-filters');
        
        // Элементы фильтров
        this.genreCheckboxes = document.getElementById('genre-checkboxes');
        this.moreGenresBtn = document.getElementById('more-genres');
        this.authorSearch = document.getElementById('author-search');
        this.authorCheckboxes = document.getElementById('author-checkboxes');
        this.yearRange = document.getElementById('year-range');
        this.yearMin = document.getElementById('year-min');
        this.yearMax = document.getElementById('year-max');
        this.pagesFilter = document.getElementById('pages-filter');
        this.languageFilter = document.getElementById('language-filter');
        this.bestsellersOnly = document.getElementById('bestsellers-only');
        this.availableOnly = document.getElementById('available-only');
        this.withCoversOnly = document.getElementById('with-covers-only');
        
        // Элементы сортировки
        this.sortBy = document.getElementById('sort-by');
        
        // Элементы результатов
        this.booksContainer = document.getElementById('books-container');
        this.loadingElement = document.getElementById('loading');
        this.errorElement = document.getElementById('error');
        this.resultsCount = document.getElementById('results-count');
        
        // Элементы пагинации
        this.prevPageBtn = document.getElementById('prev-page');
        this.nextPageBtn = document.getElementById('next-page');
        this.pageInfo = document.getElementById('page-info');
        
        // Элементы модального окна расширенного поиска
        this.advancedSearchModal = document.getElementById('advanced-search-modal');
        this.closeAdvancedSearchBtn = document.getElementById('close-advanced-search');
        this.cancelAdvancedSearchBtn = document.getElementById('cancel-advanced-search');
        this.applyAdvancedSearchBtn = document.getElementById('apply-advanced-search');
    }

    initWelcomeScreen() {
        const savedUsername = this.storage.getUsername();
        if (savedUsername) {
            this.usernameInput.value = savedUsername;
        }

        this.startButton.addEventListener('click', () => {
            const username = this.usernameInput.value.trim();
            if (username) {
                this.storage.saveUsername(username);
                this.showMainScreen(username);
            } else {
                this.showError('Пожалуйста, введите ваше имя');
            }
        });
    }

    async showMainScreen(username) {
        this.welcomeScreen.classList.add('hidden');
        this.mainScreen.classList.remove('hidden');
        this.userNameElement.textContent = username;

        try {
            this.showLoading(true);
            const { books, genres } = await this.dataService.loadInitialBooks();
            this.currentGenres = genres;
            this.setupEventListeners();
            this.populateGenreFilters();
            this.applyInitialFilters();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        // Основные кнопки
        this.applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        this.resetBtn.addEventListener('click', () => this.resetFilters());
        
        // Поиск
        this.searchInput.addEventListener('input', this.debounce(() => {
            this.currentPage = 1;
            this.applyFilters();
        }, 500));
        
        // Расширенный поиск
        this.advancedSearchBtn.addEventListener('click', () => this.showAdvancedSearch());
        this.closeAdvancedSearchBtn.addEventListener('click', () => this.hideAdvancedSearch());
        this.cancelAdvancedSearchBtn.addEventListener('click', () => this.hideAdvancedSearch());
        this.applyAdvancedSearchBtn.addEventListener('click', () => this.applyAdvancedSearch());
        
        // Пагинация
        this.prevPageBtn.addEventListener('click', () => this.goToPage(this.dataService.currentPage - 1));
        this.nextPageBtn.addEventListener('click', () => this.goToPage(this.dataService.currentPage + 1));
        
        // Диапазон года
        this.yearRange.addEventListener('input', () => {
            this.yearMax.textContent = this.yearRange.value;
        });
        
        // Показать еще жанры
        this.moreGenresBtn.addEventListener('click', () => {
            this.visibleGenresCount += 10;
            this.populateGenreFilters();
        });
        
        // Поиск авторов
        this.authorSearch.addEventListener('input', this.debounce(() => {
            this.populateAuthorFilters();
        }, 300));
    }

    async applyInitialFilters() {
        this.applyFilters();
    }

    async applyFilters() {
        const filters = {
            genres: Array.from(
                document.querySelectorAll('#genre-checkboxes input:checked')
            ).map(cb => cb.value),
            authors: Array.from(
                document.querySelectorAll('#author-checkboxes input:checked')
            ).map(cb => cb.value),
            yearFrom: 1800,
            yearTo: parseInt(this.yearRange.value),
            pages: this.pagesFilter.value,
            language: this.languageFilter.value,
            bestsellersOnly: this.bestsellersOnly.checked,
            withCoversOnly: this.withCoversOnly.checked,
            searchQuery: this.searchInput.value.trim(),
            sortOption: this.sortBy.value
        };

        try {
            this.showLoading(true);
            const { books, totalPages, totalResults } = this.dataService.applyFilters(filters);
            
            this.displayBooks(books);
            this.updatePagination(totalPages);
            this.updateResultsCount(totalResults);
            this.updateStats();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async applyAdvancedSearch() {
        const title = document.getElementById('adv-title').value.trim();
        const author = document.getElementById('adv-author').value.trim();
        const isbn = document.getElementById('adv-isbn').value.trim();
        const publisher = document.getElementById('adv-publisher').value.trim();
        const yearFrom = document.getElementById('adv-year-from').value;
        const yearTo = document.getElementById('adv-year-to').value;
        
        const options = {
            title,
            author,
            isbn,
            publisher,
            year_from: yearFrom || undefined,
            year_to: yearTo || undefined
        };

        try {
            this.showLoading(true);
            const { books, genres, authors } = await this.dataService.searchBooks(
                '', // Пустой запрос, так как используем параметры
                options
            );
            
            this.currentGenres = genres;
            this.currentAuthors = authors;
            
            this.populateGenreFilters();
            this.populateAuthorFilters();
            this.displayBooks(books);
            this.hideAdvancedSearch();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    resetFilters() {
        // Сброс элементов UI
        document.querySelectorAll('#genre-checkboxes input').forEach(cb => {
            cb.checked = false;
        });
        
        document.querySelectorAll('#author-checkboxes input').forEach(cb => {
            cb.checked = false;
        });
        
        this.yearRange.value = 2023;
        this.yearMax.textContent = '2023';
        this.pagesFilter.value = 'any';
        this.languageFilter.value = 'any';
        this.bestsellersOnly.checked = false;
        this.availableOnly.checked = false;
        this.withCoversOnly.checked = false;
        this.searchInput.value = '';
        this.sortBy.value = 'relevance';
        
        // Сброс в DataService
        this.dataService.resetFilters();
        
        // Обновление отображения
        this.applyFilters();
    }

    populateGenreFilters() {
        this.genreCheckboxes.innerHTML = '';
        
        const visibleGenres = this.currentGenres.slice(0, this.visibleGenresCount);
        
        visibleGenres.forEach(genre => {
            const checkboxId = `genre-${genre.toLowerCase().replace(/\s+/g, '-')}`;
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="${checkboxId}" value="${genre}">
                <label for="${checkboxId}">${genre}</label>
            `;
            this.genreCheckboxes.appendChild(item);
        });
        
        // Скрываем кнопку "Показать еще", если все жанры уже показаны
        this.moreGenresBtn.style.display = 
            this.visibleGenresCount >= this.currentGenres.length ? 'none' : 'block';
    }

    populateAuthorFilters() {
        this.authorCheckboxes.innerHTML = '';
        
        const searchTerm = this.authorSearch.value.toLowerCase();
        const filteredAuthors = this.currentAuthors.filter(author => 
            author.toLowerCase().includes(searchTerm)
        );
        
        filteredAuthors.slice(0, 20).forEach(author => {
            const checkboxId = `author-${author.toLowerCase().replace(/\s+/g, '-')}`;
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="${checkboxId}" value="${author}">
                <label for="${checkboxId}">${author}</label>
            `;
            this.authorCheckboxes.appendChild(item);
        });
    }

    displayBooks(books) {
        this.booksContainer.innerHTML = '';
        
        if (books.length === 0) {
            this.booksContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-book-open"></i>
                    <p>Книги не найдены. Попробуйте изменить параметры поиска.</p>
                </div>
            `;
            return;
        }
        
        books.forEach(book => {
            const card = this.createBookCard(book);
            this.booksContainer.appendChild(card);
        });
    }

    createBookCard(book) {
        const card = document.createElement('div');
        card.className = 'book-card';
        
        const cover = book.cover 
            ? `<img src="${book.cover}" alt="Обложка ${book.title}" class="book-cover">`
            : `<div class="book-cover placeholder"><i class="fas fa-book"></i></div>`;
        
        const year = book.year ? `<p><i class="fas fa-calendar-alt"></i> ${book.year} год</p>` : '';
        const pages = book.pages ? `<p><i class="fas fa-file-alt"></i> ${book.pages} стр.</p>` : '';
        const genre = book.genre ? `<p><i class="fas fa-tag"></i> ${book.genre.split(',').slice(0, 2).join(', ')}</p>` : '';
        
        card.innerHTML = `
            ${cover}
            <div class="book-info">
                <h3>${book.title}</h3>
                <p class="author"><i class="fas fa-user-edit"></i> ${book.author}</p>
                ${year}
                ${pages}
                ${genre}
                <button class="btn details-btn">Подробнее</button>
            </div>
        `;
        
        // Добавляем обработчик для кнопки "Подробнее"
        card.querySelector('.details-btn').addEventListener('click', () => {
            this.showBookDetails(book);
        });
        
        return card;
    }

    showBookDetails(book) {
        // В реальном приложении можно открыть модальное окно с подробной информацией
        alert(`Подробная информация о книге:\n\nНазвание: ${book.title}\nАвтор: ${book.author}\nГод: ${book.year || 'неизвестен'}\nСтраниц: ${book.pages || 'неизвестно'}\nЖанр: ${book.genre || 'не указан'}`);
    }

    updatePagination(totalPages) {
        const currentPage = this.dataService.currentPage;
        
        this.pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
        this.prevPageBtn.disabled = currentPage <= 1;
        this.nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
    }

    updateResultsCount(count) {
        this.resultsCount.querySelector('span').textContent = count;
    }

    updateStats() {
        const stats = this.dataService.getStats();
        if (!stats) {
            return;
        }
        
        // В реальном приложении можно обновлять статистику на странице
        console.log('Статистика:', stats);
    }

    async goToPage(page) {
        try {
            this.showLoading(true);
            const { books, totalPages } = this.dataService.goToPage(page);
            
            this.displayBooks(books);
            this.updatePagination(totalPages);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showAdvancedSearch() {
        this.advancedSearchModal.classList.remove('hidden');
    }

    hideAdvancedSearch() {
        this.advancedSearchModal.classList.add('hidden');
    }

    showLoading(show) {
        if (show) {
            this.loadingElement.classList.remove('hidden');
            this.errorElement.classList.add('hidden');
        } else {
            this.loadingElement.classList.add('hidden');
        }
    }

    showError(message) {
        this.errorElement.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
        `;
        this.errorElement.classList.remove('hidden');
    }

    debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
}
