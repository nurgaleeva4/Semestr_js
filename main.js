import { Storage } from './modules/storage.js';
import { ApiService } from './modules/api.js';
import { DataService } from './modules/data.js';
import { UI } from './modules/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const storage = new Storage();
    const apiService = new ApiService();
    const dataService = new DataService(apiService);
    const ui = new UI(dataService, storage);

    ui.initWelcomeScreen();
});
