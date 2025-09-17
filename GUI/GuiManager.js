const CATEGORY_BOX_HEIGHT = 40;

const Module_icon = Image.fromAsset('folder.png');

import { ToggleButton } from './Toggle';
import { Slider } from './Slider';
import { MultiToggle } from './Dropdown';
import {
    isInside,
    playClickSound,
    easeInOutQuad,
    PADDING,
    BORDER_WIDTH,
    CORNER_RADIUS,
    CATEGORY_HEIGHT,
    CATEGORY_PADDING,
    LEFT_PANEL_TEXT_HEIGHT,
    CATEGORY_OFFSET_Y,
    CATEGORY_BOX_PADDING,
    ITEM_SPACING,
    SEPARATOR_HEIGHT,
    SUBCATEGORY_BUTTON_HEIGHT,
    SUBCATEGORY_BUTTON_SPACING,
    THEME,
} from './Utils';
import { getSetting } from '../GUI/GuiSave';

import { Color } from '../Utility/Constants';

global.Categories = {
    categories: [
        {
            name: 'Modules',
            items: [],
            subcategories: [],
        },
    ],
    selected: 'Modules',
    selectedItem: null,
    currentPage: 'categories', // "categories" or "options"
    transitionProgress: 0,
    transitionDirection: 0,
    transitionStart: 0,
    selectedSubcategory: null,
    selectedSubcategoryButton: null,
    subcatTransitionProgress: 1,
    subcatTransitionStart: 0,
    subcatAnimationDuration: 200,
    animationRect: null,
    optionsScrollY: 0,

    addCategoryItem(subcategoryName, title, description) {
        const category = global.Categories.categories.find(
            (c) => c.name === 'Modules'
        );
        if (!category) return;

        const newItem = {
            title,
            description,
            expanded: false,
            animation: CATEGORY_BOX_HEIGHT,
            components: [],
            type: 'item',
            subcategoryName: subcategoryName,
        };

        if (subcategoryName) {
            let subcategory = category.items.find(
                (item) =>
                    item.type === 'separator' && item.title === subcategoryName
            );

            if (!subcategory) {
                subcategory = {
                    title: subcategoryName,
                    type: 'separator',
                    items: [],
                };
                category.items.push(subcategory);
                category.subcategories.push(subcategoryName);
            }
            subcategory.items.push(newItem);
        } else {
            category.items.push(newItem);
        }
    },

    findItem(categoryName, itemName) {
        const category = global.Categories.categories.find(
            (c) => c.name === categoryName
        );
        if (!category) return null;

        for (const group of category.items) {
            if (group.type === 'separator') {
                const item = group.items.find((i) => i.title === itemName);
                if (item) return item;
            } else if (group.title === itemName) {
                return group;
            }
        }
        return null;
    },

    addToggle(categoryName, itemName, toggleTitle, callback = null) {
        const item = global.Categories.findItem(categoryName, itemName);
        if (!item) return;

        item.components.push(
            new ToggleButton(toggleTitle, 0, 0, undefined, undefined, callback)
        );
        if (callback) callback(getSetting(itemName, toggleTitle));
    },

    addSlider(
        categoryName,
        itemName,
        sliderTitle,
        min,
        max,
        defaultValue,
        callback = null
    ) {
        const item = global.Categories.findItem(categoryName, itemName);
        if (!item) return;

        item.components.push(
            new Slider(
                sliderTitle,
                min,
                max,
                0,
                0,
                undefined,
                undefined,
                defaultValue,
                callback
            )
        );
        if (callback) callback(getSetting(itemName, sliderTitle));
    },

    addMultiToggle(
        categoryName,
        itemName,
        toggleTitle,
        options,
        singleSelect = false,
        callback = null
    ) {
        const item = global.Categories.findItem(categoryName, itemName);
        if (!item) return;

        item.components.push(
            new MultiToggle(toggleTitle, 0, 0, options, singleSelect, callback)
        );
        if (callback) callback(getSetting(itemName, toggleTitle));
    },
};

global.createCategoriesManager = (deps) => {
    const CATEGORY_TITLE_COLOR = THEME.GUI_MANAGER_CATEGORY_TITLE;
    const CATEGORY_DESC_COLOR = THEME.GUI_MANAGER_CATEGORY_DESCRIPTION;
    const BACK_TEXT_COLOR = THEME.GUI_MANAGER_BACK_TEXT;

    const CATEGORY_BOX_COLOR = THEME.GUI_MANAGER_CATEGORY_BOX;
    const UNIVERSAL_GRAY_COLOR = THEME.GUI_MANAGER_UNIVERSAL_GRAY;
    const CATEGORY_SELECTED_COLOR = THEME.GUI_MANAGER_CATEGORY_SELECTED;

    const SCROLL_SPEED = 15;
    const ANIMATION_DURATION = 300;
    let rightPanelScrollY = 0;
    let cachedItemLayouts = [];
    let isLayoutCacheValid = false;

    let cachedContentHeight = 0;
    let isContentHeightCacheValid = false;

    const closeAllDropdowns = () => {
        const selectedItem = global.Categories.selectedItem;
        if (!selectedItem || !selectedItem.components) return;

        selectedItem.components.forEach((component) => {
            if (component instanceof MultiToggle && component.expanded) {
                component.expanded = false;
                component.animationProgress = 0;
                component.animStart = 0;
            }
        });
    };

    const getCategoryRect = (index) => {
        return {
            x: deps.rectangles.LeftPanel.x + PADDING,
            y:
                deps.rectangles.LeftPanel.y +
                PADDING +
                CATEGORY_OFFSET_Y +
                index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
            width: deps.rectangles.LeftPanel.width - PADDING * 2,
            height: CATEGORY_HEIGHT,
        };
    };

    const cat = global.Categories;
    const drawSubcategoryButtons = (panelX, yOffset) => {
        if (cat.animationRect) {
            const elapsed = Date.now() - cat.subcatTransitionStart;
            const rawProgress = Math.min(
                1,
                elapsed / cat.subcatAnimationDuration
            );
            cat.subcatTransitionProgress = easeInOutQuad(rawProgress);
            const p = cat.subcatTransitionProgress;

            cat.animationRect.x =
                cat.animationRect.startX +
                (cat.animationRect.endX - cat.animationRect.startX) * p;
            cat.animationRect.width =
                cat.animationRect.startWidth +
                (cat.animationRect.endWidth - cat.animationRect.startWidth) * p;

            if (rawProgress >= 1) {
                cat.animationRect = null;
            }
        }

        let currentX = panelX + PADDING;
        const subcategoriesToDraw = [
            'All',
            ...cat.categories.find((c) => c.name === cat.selected)
                .subcategories,
        ];

        subcategoriesToDraw.forEach((subcat) => {
            const buttonTextWidth = Renderer.getStringWidth(subcat) + 10;
            const buttonRect = {
                x: currentX,
                y: yOffset,
                width: buttonTextWidth,
                height: SUBCATEGORY_BUTTON_HEIGHT,
                radius: 5,
                color: UNIVERSAL_GRAY_COLOR,
            };

            const isSelected =
                (cat.selectedSubcategory === subcat ||
                    (!cat.selectedSubcategory && subcat === 'All')) &&
                !cat.animationRect;

            if (isSelected) cat.selectedSubcategoryButton = buttonRect;

            if (cat.animationRect) {
                deps.draw.drawRoundedRectangle({
                    x: cat.animationRect.x,
                    y: cat.animationRect.y,
                    width: cat.animationRect.width,
                    height: cat.animationRect.height,
                    radius: 5,
                    color: CATEGORY_SELECTED_COLOR,
                });
            } else if (isSelected) {
                deps.draw.drawRoundedRectangle({
                    x: buttonRect.x,
                    y: buttonRect.y,
                    width: buttonRect.width,
                    height: buttonRect.height,
                    radius: 5,
                    color: CATEGORY_SELECTED_COLOR,
                });
            }

            Renderer.drawString(
                subcat,
                currentX + 5,
                yOffset + (SUBCATEGORY_BUTTON_HEIGHT - 8) / 2,
                isSelected ? CATEGORY_TITLE_COLOR : CATEGORY_DESC_COLOR,
                false
            );
            currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
        });

        return yOffset + SUBCATEGORY_BUTTON_HEIGHT + PADDING;
    };

    const drawOptionsPanel = (panel, mouseX, mouseY) => {
        const selectedItem = global.Categories.selectedItem;
        if (!selectedItem) return;

        let optionPanelX = panel.x;
        if (global.Categories.transitionDirection === 1) {
            optionPanelX +=
                panel.width * (1 - global.Categories.transitionProgress);
        } else if (global.Categories.transitionDirection === -1) {
            optionPanelX += panel.width * global.Categories.transitionProgress;
        }

        const optionX = optionPanelX + PADDING;
        const optionY = panel.y + PADDING;

        const scrollY = global.Categories.optionsScrollY;

        const backButtonText = 'Back';
        const backButtonX = optionX + 10;
        const backButtonY = optionY + 10;
        const drawnBackY = backButtonY - scrollY;
        Renderer.drawString(
            backButtonText,
            backButtonX,
            drawnBackY,
            BACK_TEXT_COLOR
        );

        const drawnTitleY = optionY + 30 - scrollY;
        Renderer.drawString(
            selectedItem.title,
            backButtonX,
            drawnTitleY,
            CATEGORY_TITLE_COLOR,
            false
        );
        const drawnDescY = optionY + 45 - scrollY;
        Renderer.drawString(
            selectedItem.description,
            backButtonX + 10,
            drawnDescY,
            CATEGORY_DESC_COLOR,
            false
        );

        let drawnCompY = optionY + 70 - scrollY;
        selectedItem.components.forEach((component) => {
            if (typeof component.draw !== 'function') return;

            component.x = optionX + 10;
            component.y = drawnCompY;
            component.optionPanelWidth = panel.width;
            component.optionPanelHeight = panel.height;

            component.draw();

            let thisHeight = 45;
            if (
                component instanceof MultiToggle &&
                component.animationProgress > 0
            ) {
                thisHeight +=
                    component.getExpandedHeight() * component.animationProgress;
            }
            drawnCompY += thisHeight;
        });
    };

    const draw = (mouseX, mouseY) => {
        if (global.Categories.transitionDirection !== 0) {
            const elapsed = Date.now() - global.Categories.transitionStart;
            const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
            global.Categories.transitionProgress = easeInOutQuad(rawProgress);

            if (rawProgress >= 1) {
                const newPage =
                    global.Categories.transitionDirection === 1
                        ? 'options'
                        : 'categories';
                global.Categories.currentPage = newPage;
                if (newPage === 'categories') {
                    global.Categories.selectedItem = null;
                }
                if (newPage === 'options') {
                    global.Categories.optionsScrollY = 0;
                }
                global.Categories.transitionDirection = 0;
                isLayoutCacheValid = false;
            }
        }

        global.Categories.categories.forEach((cat, i) => {
            const rect = getCategoryRect(i);
            const lineY = rect.y + rect.height - 2;

            const iconY =
                lineY - (rect.height - 2 - LEFT_PANEL_TEXT_HEIGHT) / 2 - 1;
            const iconX = rect.x + (rect.width - 25) / 2;
            const moduleSize = 25;

            if (
                cat.name === 'Modules' &&
                global.Categories.selected === 'Modules'
            ) {
                deps.draw.drawRoundedRectangle({
                    x: iconX - 1,
                    y: iconY - 10,
                    width: moduleSize,
                    height: moduleSize,
                    radius: 5,
                    color: CATEGORY_SELECTED_COLOR,
                });
            }

            Module_icon.draw(iconX - 1, iconY - 10, moduleSize, moduleSize);
            const pfpX = iconX - 1;
            const pfpY = iconY - 73;
            const iconSize = moduleSize - 2;
            if (global.discordPfp) {
                Renderer.drawImage(
                    global.discordPfp,
                    pfpX,
                    pfpY,
                    iconSize,
                    iconSize
                );
            }
        });

        const cat = global.Categories.categories.find(
            (c) => c.name === global.Categories.selected
        );
        if (!cat) return;

        const panel = deps.rectangles.RightPanel;
        const panelWidth = panel.width - PADDING * 2;
        const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;

        const scale = Renderer.screen.getScale();
        GL11.glEnable(GL11.GL_SCISSOR_TEST);

        const inset = 2;
        const scissorX = panel.x + inset;
        const scissorY = panel.y + inset;
        const scissorW = panel.width - inset * 2;
        const scissorH = panel.height - inset * 2;

        GL11.glScissor(
            Math.floor(scissorX * scale),
            Math.floor(
                (Renderer.screen.getHeight() - (scissorY + scissorH)) * scale
            ),
            Math.floor(scissorW * scale),
            Math.floor(scissorH * scale)
        );

        const transitionActive = global.Categories.transitionDirection !== 0;
        const shouldDrawItems =
            global.Categories.currentPage === 'categories' || transitionActive;
        const shouldDrawOptions =
            global.Categories.currentPage === 'options' || transitionActive;

        if (shouldDrawItems) {
            if (!isLayoutCacheValid) cachedItemLayouts = [];

            let panelX = panel.x;
            if (global.Categories.transitionDirection === 1)
                panelX -= panel.width * global.Categories.transitionProgress;
            else if (global.Categories.transitionDirection === -1)
                panelX -=
                    panel.width * (1 - global.Categories.transitionProgress);

            let yOffset = panel.y + PADDING;
            if (cat.subcategories.length > 0) {
                yOffset = drawSubcategoryButtons(
                    panelX,
                    yOffset,
                    mouseX,
                    mouseY
                );
            }

            yOffset -= rightPanelScrollY;
            let itemIndexInRow = 0;
            const itemsToDisplay = global.Categories.selectedSubcategory
                ? cat.items.filter(
                      (group) =>
                          group.type === 'separator' &&
                          group.title === global.Categories.selectedSubcategory
                  )
                : cat.items;

            itemsToDisplay.forEach((group) => {
                if (group.type === 'separator') {
                    const separatorY = yOffset + SEPARATOR_HEIGHT / 2;
                    const separatorX = panelX + PADDING;
                    const separatorWidth = panelWidth;

                    deps.draw.drawRoundedRectangle({
                        x: separatorX,
                        y: separatorY,
                        width: separatorWidth,
                        height: 1,
                        radius: 5,
                        color: UNIVERSAL_GRAY_COLOR,
                    });

                    const separatorTextWidth = Renderer.getStringWidth(
                        group.title
                    );
                    const separatorTextX =
                        separatorX +
                        separatorWidth / 2 -
                        separatorTextWidth / 2;
                    Renderer.drawString(
                        group.title,
                        separatorTextX,
                        separatorY - 10,
                        CATEGORY_DESC_COLOR,
                        false
                    );
                    yOffset += SEPARATOR_HEIGHT;
                    let subcategoryItemsInRow = 0;
                    group.items.forEach((item) => {
                        const col = subcategoryItemsInRow % 3;
                        if (col === 0 && subcategoryItemsInRow > 0)
                            yOffset +=
                                CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;

                        const itemX =
                            panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                        const itemRect = {
                            x: itemX,
                            y: yOffset,
                            width: itemWidth,
                            height: CATEGORY_BOX_HEIGHT,
                            radius: CORNER_RADIUS,
                            color: CATEGORY_BOX_COLOR,
                            borderWidth: 0.5,
                            borderColor: THEME.GUI_MANAGER_CATEGORY_BOX_BORDER,
                        };

                        const isHovered = isInside(mouseX, mouseY, itemRect);
                        itemRect.color = isHovered
                            ? UNIVERSAL_GRAY_COLOR
                            : CATEGORY_BOX_COLOR;

                        deps.draw.drawRoundedRectangleWithBorder(itemRect);

                        if (!isLayoutCacheValid)
                            cachedItemLayouts.push({ rect: itemRect, item });

                        Renderer.drawString(
                            item.title,
                            itemX +
                                itemWidth / 2 -
                                Renderer.getStringWidth(item.title) / 2,
                            yOffset + CATEGORY_BOX_HEIGHT / 2 - 4,
                            CATEGORY_TITLE_COLOR,
                            false
                        );
                        subcategoryItemsInRow++;
                    });
                    const itemsInSubcategory = group.items.length;
                    const numRows = Math.ceil(itemsInSubcategory / 3);
                    yOffset +=
                        numRows > 0
                            ? CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING
                            : 0;
                } else {
                    if (global.Categories.selectedSubcategory !== null) return;
                    const item = group;
                    const col = itemIndexInRow % 3;
                    if (col === 0 && itemIndexInRow > 0)
                        yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;

                    const itemX =
                        panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                    const itemRect = {
                        x: itemX,
                        y: yOffset,
                        width: itemWidth,
                        height: CATEGORY_BOX_HEIGHT,
                        radius: CORNER_RADIUS,
                        color: CATEGORY_BOX_COLOR,
                        borderWidth: BORDER_WIDTH,
                    };

                    const isHovered = isInside(mouseX, mouseY, itemRect);
                    itemRect.color = isHovered
                        ? UNIVERSAL_GRAY_COLOR
                        : CATEGORY_BOX_COLOR;

                    if (!isLayoutCacheValid)
                        cachedItemLayouts.push({ rect: itemRect, item });

                    Renderer.drawString(
                        item.title,
                        itemX + 5,
                        yOffset + CATEGORY_BOX_HEIGHT / 2 - 4,
                        CATEGORY_TITLE_COLOR,
                        false
                    );
                    itemIndexInRow++;
                }
            });

            if (!isLayoutCacheValid) isLayoutCacheValid = true;
        }
        if (shouldDrawOptions) drawOptionsPanel(panel, mouseX, mouseY);

        GL11.glDisable(GL11.GL_SCISSOR_TEST);
    };

    const handleClick = (mouseX, mouseY) => {
        if (global.Categories.transitionDirection !== 0) return;

        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const panel = deps.rectangles.RightPanel;
            const optionX = panel.x + PADDING;
            const optionY = panel.y + PADDING;
            const scrollY = global.Categories.optionsScrollY;

            const backButtonText = 'Back';
            const backButtonWidth = Renderer.getStringWidth(backButtonText);
            const drawnBackY = optionY + 10 - scrollY;
            const backButtonRect = {
                x: optionX + 10,
                y: drawnBackY,
                width: backButtonWidth,
                height: 10,
            };
            if (isInside(mouseX, mouseY, backButtonRect)) {
                global.Categories.transitionDirection = -1;
                global.Categories.transitionProgress = 0;
                global.Categories.transitionStart = Date.now();
                playClickSound();
                return;
            }

            const components = global.Categories.selectedItem.components;
            let currentCompY = optionY + 70;
            let currentDrawnCompY = currentCompY - scrollY;

            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                if (typeof component.handleClick !== 'function') continue;

                const drawnCompY = currentDrawnCompY;
                let handled = false;

                component.x = optionX + 10;
                if (component instanceof MultiToggle) {
                    component.y = drawnCompY;
                    if (component.handleClick(mouseX, mouseY)) {
                        handled = true;
                    }
                } else {
                    let componentHeight = 40;
                    let clickableArea = {
                        x: optionX, // component.x - 10, but since x = optionX +10, x-10 = optionX
                        y: drawnCompY,
                        width: panel.width - 2 * PADDING - 20,
                        height: componentHeight,
                    };
                    if (isInside(mouseX, mouseY, clickableArea)) {
                        component.y = drawnCompY;
                        if (component.handleClick(mouseX, mouseY)) {
                            handled = true;
                        }
                    }
                }

                if (handled) return;

                let thisHeight = 45;
                if (
                    component instanceof MultiToggle &&
                    component.animationProgress > 0
                ) {
                    thisHeight +=
                        component.getExpandedHeight() *
                        component.animationProgress;
                }
                currentCompY += thisHeight;
                currentDrawnCompY += thisHeight;
            }

            const leftPanel = deps.rectangles.LeftPanel;
            if (isInside(mouseX, mouseY, leftPanel)) {
                let clickedCategory = null;
                global.Categories.categories.forEach((cat, i) => {
                    const rect = getCategoryRect(i);
                    if (isInside(mouseX, mouseY, rect)) {
                        clickedCategory = cat.name;
                        return;
                    }
                });
                if (
                    clickedCategory &&
                    clickedCategory !== global.Categories.selected
                ) {
                    global.Categories.selected = clickedCategory;
                }
                global.Categories.transitionDirection = -1;
                global.Categories.transitionProgress = 0;
                global.Categories.transitionStart = Date.now();
                playClickSound();
                return;
            }

            if (!isInside(mouseX, mouseY, deps.rectangles.RightPanel)) {
                global.Categories.transitionDirection = -1;
                global.Categories.transitionProgress = 0;
                global.Categories.transitionStart = Date.now();
            }
        } else {
            const wasCategoryClicked = global.Categories.categories.some(
                (cat, i) => {
                    const rect = getCategoryRect(i);
                    if (isInside(mouseX, mouseY, rect)) {
                        global.Categories.selected = cat.name;
                        global.Categories.currentPage = 'categories';
                        global.Categories.selectedItem = null;
                        global.Categories.selectedSubcategory = null;
                        isContentHeightCacheValid = false;
                        isLayoutCacheValid = false;
                        rightPanelScrollY = 0;
                        playClickSound();
                        return true;
                    }
                    return false;
                }
            );

            if (
                !wasCategoryClicked &&
                isInside(mouseX, mouseY, deps.rectangles.LeftPanel)
            ) {
                global.Categories.selected = null;
                isLayoutCacheValid = false;
                isContentHeightCacheValid = false;
                playClickSound();
            }

            if (
                global.Categories.selected &&
                global.Categories.currentPage === 'categories'
            ) {
                const cat = global.Categories.categories.find(
                    (c) => c.name === global.Categories.selected
                );
                if (!cat) return;

                const panel = deps.rectangles.RightPanel;
                if (cat.subcategories.length > 0) {
                    let currentX = panel.x + PADDING;
                    let yOffset = panel.y + PADDING;
                    const subcategoriesToDraw = ['All', ...cat.subcategories];
                    for (const subcat of subcategoriesToDraw) {
                        const buttonTextWidth =
                            Renderer.getStringWidth(subcat) + 10;
                        const buttonRect = {
                            x: currentX,
                            y: yOffset,
                            width: buttonTextWidth,
                            height: SUBCATEGORY_BUTTON_HEIGHT,
                        };
                        if (isInside(mouseX, mouseY, buttonRect)) {
                            const newSubcatName =
                                subcat === 'All' ? null : subcat;
                            if (
                                global.Categories.selectedSubcategory !==
                                newSubcatName
                            ) {
                                const oldRect =
                                    global.Categories
                                        .selectedSubcategoryButton ||
                                    buttonRect;
                                global.Categories.selectedSubcategory =
                                    newSubcatName;
                                isContentHeightCacheValid = false;
                                isLayoutCacheValid = false;
                                rightPanelScrollY = 0;
                                global.Categories.subcatTransitionStart =
                                    Date.now();
                                global.Categories.subcatTransitionProgress = 0;
                                global.Categories.animationRect = {
                                    startX: oldRect.x,
                                    startY: oldRect.y,
                                    startWidth: oldRect.width,
                                    startHeight: oldRect.height,
                                    endX: buttonRect.x,
                                    endY: buttonRect.y,
                                    endWidth: buttonRect.width,
                                    endHeight: buttonRect.height,
                                    x: oldRect.x,
                                    y: oldRect.y,
                                    width: oldRect.width,
                                    height: oldRect.height,
                                };
                                global.Categories.selectedSubcategoryButton =
                                    buttonRect;
                            }
                            playClickSound();
                            return;
                        }
                        currentX +=
                            buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
                    }
                }

                for (const layout of cachedItemLayouts) {
                    if (isInside(mouseX, mouseY, layout.rect)) {
                        global.Categories.transitionDirection = 1;
                        global.Categories.transitionProgress = 0;
                        global.Categories.transitionStart = Date.now();
                        global.Categories.selectedItem = layout.item;
                        playClickSound();
                        return;
                    }
                }
            }
        }
    };

    const handleScroll = (mouseX, mouseY, dir) => {
        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const panel = deps.rectangles.RightPanel;
            const optionX = panel.x + PADDING;
            const optionY = panel.y + PADDING;

            let scrollHandled = false;
            let componentY = optionY + 70;
            const components = global.Categories.selectedItem.components;
            if (components) {
                components.forEach((component) => {
                    let compHeight = 45;
                    if (component instanceof MultiToggle) {
                        compHeight +=
                            component.getExpandedHeight() *
                            component.animationProgress;
                    }
                    const compRect = {
                        x: optionX + 10,
                        y: componentY,
                        width: panel.width - PADDING * 2 - 20,
                        height: compHeight,
                    };
                    if (
                        isInside(mouseX, mouseY, compRect) &&
                        typeof component.handleScroll === 'function'
                    ) {
                        component.handleScroll(mouseX, mouseY, dir);
                        scrollHandled = true;
                    }
                    componentY += compHeight;
                });
            }

            if (!scrollHandled && isInside(mouseX, mouseY, panel)) {
                let componentsHeight = componentY - (optionY + 70);
                const fixedTop = 70 + PADDING;
                const bottomPadding = PADDING;
                const availableHeight = panel.height - fixedTop - bottomPadding;
                const maxScroll = Math.max(
                    0,
                    componentsHeight - availableHeight
                );
                const direction = dir > 0 ? -1 : 1;
                global.Categories.optionsScrollY += direction * SCROLL_SPEED;
                global.Categories.optionsScrollY = Math.max(
                    0,
                    Math.min(global.Categories.optionsScrollY, maxScroll)
                );
            }

            return;
        }
        if (
            global.Categories.currentPage !== 'categories' ||
            global.Categories.transitionDirection !== 0
        )
            return;

        const panel = deps.rectangles.RightPanel;
        if (!global.Categories.selected || !isInside(mouseX, mouseY, panel)) {
            return;
        }

        if (!isContentHeightCacheValid) isContentHeightCacheValid = true;

        const maxScroll = Math.max(
            0,
            cachedContentHeight - panel.height + PADDING
        );
        const direction = dir > 0 ? -1 : 1;
        rightPanelScrollY += direction * SCROLL_SPEED;
        rightPanelScrollY = Math.max(0, Math.min(rightPanelScrollY, maxScroll));

        isLayoutCacheValid = false;
    };

    const handleMouseDrag = (mouseX, mouseY) => {
        if (isLayoutCacheValid) isLayoutCacheValid = false;

        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const components = global.Categories.selectedItem.components;
            if (!components) return;
            components.forEach((component) => {
                if (typeof component.handleMouseDrag !== 'function') return;
                component.handleMouseDrag(mouseX, mouseY);
            });
        }
    };

    const handleMouseRelease = () => {
        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const components = global.Categories.selectedItem.components;
            if (!components) return;
            components.forEach((component) => {
                if (typeof component.handleMouseRelease !== 'function') return;
                component.handleMouseRelease();
            });
        }
    };

    return {
        draw,
        handleClick,
        handleScroll,
        handleMouseDrag,
        handleMouseRelease,
        invalidateLayoutCache: () => {
            isLayoutCacheValid = false;
        },
        invalidateContentHeightCache: () => {
            isContentHeightCacheValid = false;
        },
    };
};
