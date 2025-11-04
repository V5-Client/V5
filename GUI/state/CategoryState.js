export class CategoryState {
    constructor() {
        this.categories = [
            { name: 'Modules', items: [], subcategories: [] },
            { name: 'Settings', items: [], subcategories: [] },
        ];

        this.selected = 'Modules';
        this.selectedItem = null;
        this.selectedSubcategory = null;
        this.currentPage = 'categories';

        // Transitions
        this.transition = {
            progress: 0,
            direction: 0,
            startTime: 0,
        };

        // Subcategory animation
        this.subcatAnimation = {
            rect: null,
            progress: 1,
            startTime: 0,
            duration: 200,
        };

        // Category animation
        this.categoryAnimation = {
            rect: null,
            startTime: 0,
            duration: 200,
        };

        this.selectedSubcategoryButton = null;
        this.optionsScrollY = 0;
    }

    // Getters
    getCategory(name) {
        return this.categories.find((c) => c.name === name);
    }

    getSelectedCategory() {
        return this.getCategory(this.selected);
    }

    isTransitioning() {
        return this.transition.direction !== 0;
    }

    // State mutations
    selectCategory(name) {
        this.selected = name;
    }

    selectItem(item) {
        this.selectedItem = item;
        this.currentPage = 'options';
    }

    goBack() {
        this.selectedItem = null;
        this.currentPage = 'categories';
    }

    startTransition(direction) {
        this.transition = {
            progress: 0,
            direction,
            startTime: Date.now(),
        };
    }

    updateTransition(easedProgress) {
        this.transition.progress = easedProgress;
    }

    completeTransition() {
        const newPage = this.transition.direction === 1 ? 'options' : 'categories';
        this.currentPage = newPage;

        if (newPage === 'categories') {
            this.selectedItem = null;
        }
        if (newPage === 'options') {
            this.optionsScrollY = 0;
        }

        this.transition.direction = 0;
        this.transition.progress = 1;
    }

    resetScrolls() {
        this.optionsScrollY = 0;
    }
}
