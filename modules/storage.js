export class Storage {
    constructor() {
        this.usernameKey = 'bookExplorerUsername';
    }

    saveUsername(username) {
        localStorage.setItem(this.usernameKey, username);
    }

    getUsername() {
        return localStorage.getItem(this.usernameKey);
    }

    saveFilters(filters) {
        localStorage.setItem(`${this.usernameKey}_filters`, JSON.stringify(filters));
    }

    getFilters() {
        const filters = localStorage.getItem(`${this.usernameKey}_filters`);
        return filters ? JSON.parse(filters) : null;
    }
}
