const Color = java.awt.Color;

const CATEGORY_BOX_HEIGHT = 40;

const Module_icon = Image.fromAsset('folder.png');

import { ToggleButton } from './Toggle';
import { Slider } from './Slider';
import { MultiToggle } from './Dropdown';
import { isInside, playClickSound } from './Utils';

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

    addToggle(categoryName, itemName, toggleTitle) {
        const category = global.Categories.categories.find(
            (c) => c.name === categoryName
        );
        if (!category) return;

        let item = null;
        for (const group of category.items) {
            if (group.type === 'separator') {
                item = group.items.find((i) => i.title === itemName);
                if (item) break;
            } else if (group.title === itemName) {
                item = group;
                break;
            }
        }
        if (!item) return;

        item.components.push(new ToggleButton(toggleTitle, 0, 0));
    },
    addSlider(categoryName, itemName, sliderTitle, min, max) {
        const category = global.Categories.categories.find(
            (c) => c.name === categoryName
        );
        if (!category) return;

        let item = null;
        for (const group of category.items) {
            if (group.type === 'separator') {
                item = group.items.find((i) => i.title === itemName);
                if (item) break;
            } else if (group.title === itemName) {
                item = group;
                break;
            }
        }
        if (!item) return;

        item.components.push(new Slider(sliderTitle, min, max, 0, 0));
    },

    addMultiToggle(
        categoryName,
        itemName,
        toggleTitle,
        options,
        singleSelect = false
    ) {
        const category = global.Categories.categories.find(
            (c) => c.name === categoryName
        );
        if (!category) return;

        let item = null;
        for (const group of category.items) {
            if (group.type === 'separator') {
                item = group.items.find((i) => i.title === itemName);
                if (item) break;
            } else if (group.title === itemName) {
                item = group;
                break;
            }
        }
        if (!item) return;

        item.components.push(
            new MultiToggle(toggleTitle, 0, 0, options, singleSelect)
        );
    },
};

global.createCategoriesManager = (deps) => {
    const CATEGORY_HEIGHT = 30;
    const CATEGORY_PADDING = 5;
    const LEFT_PANEL_TEXT_HEIGHT = 8;
    const CATEGORY_OFFSET_Y = 50;

    const PADDING = 10;
    const CORNER_RADIUS = 10;
    const BORDER_WIDTH = 2;
    const CATEGORY_BOX_PADDING = 5;
    const ITEM_SPACING = 5;
    const SEPARATOR_HEIGHT = 20;
    const SUBCATEGORY_BUTTON_HEIGHT = 20;
    const SUBCATEGORY_BUTTON_SPACING = 5;

    const CATEGORY_TITLE_COLOR = 0xffffff;
    const CATEGORY_DESC_COLOR = 0xaaaaaa;
    const CATEGORY_BOX_COLOR = new Color(0.18, 0.18, 0.18, 1);
    const CATEGORY_BOX_HOVER_COLOR = new Color(0.25, 0.25, 0.25, 1);
    const SEPARATOR_COLOR = new Color(0.25, 0.25, 0.25, 1);
    const SUBCATEGORY_BUTTON_COLOR = new Color(0.15, 0.15, 0.15, 1);
    const SUBCATEGORY_BUTTON_HOVER_COLOR = new Color(0.22, 0.22, 0.22, 0.8);
    const CATEGORY_SELECTED_COLOR = new Color(0.502, 0.302, 0.702, 0.3);
    const BACK_TEXT_COLOR = 0xccb380e6;

    const SCROLL_SPEED = 15;
    const ANIMATION_DURATION = 300;
    let rightPanelScrollY = 0;

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
    const easeInOutQuad = (t) =>
        t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const drawSubcategoryButtons = (panelX, yOffset, mouseX, mouseY) => {
        if (global.Categories.animationRect) {
            const elapsed =
                Date.now() - global.Categories.subcatTransitionStart;
            const rawProgress = Math.min(
                1,
                elapsed / global.Categories.subcatAnimationDuration
            );
            global.Categories.subcatTransitionProgress =
                easeInOutQuad(rawProgress);
            const p = global.Categories.subcatTransitionProgress;

            global.Categories.animationRect.x =
                global.Categories.animationRect.startX +
                (global.Categories.animationRect.endX -
                    global.Categories.animationRect.startX) *
                    p;
            global.Categories.animationRect.width =
                global.Categories.animationRect.startWidth +
                (global.Categories.animationRect.endWidth -
                    global.Categories.animationRect.startWidth) *
                    p;

            if (rawProgress >= 1) {
                global.Categories.animationRect = null; // Animation is complete
            }
        }

        let currentX = panelX + PADDING;
        const subcategoriesToDraw = [
            'All',
            ...global.Categories.categories.find(
                (c) => c.name === global.Categories.selected
            ).subcategories,
        ];

        subcategoriesToDraw.forEach((subcat) => {
            const buttonTextWidth = Renderer.getStringWidth(subcat) + 10;
            const buttonRect = {
                x: currentX,
                y: yOffset,
                width: buttonTextWidth,
                height: SUBCATEGORY_BUTTON_HEIGHT,
                radius: 5,
                color: SUBCATEGORY_BUTTON_COLOR,
            };

            const isSelected =
                (global.Categories.selectedSubcategory === subcat ||
                    (!global.Categories.selectedSubcategory &&
                        subcat === 'All')) &&
                !global.Categories.animationRect;
            const isHovered = isInside(mouseX, mouseY, buttonRect);
            const buttonColor = isSelected
                ? CATEGORY_SELECTED_COLOR
                : isHovered
                  ? SUBCATEGORY_BUTTON_HOVER_COLOR
                  : SUBCATEGORY_BUTTON_COLOR;

            if (isSelected) {
                global.Categories.selectedSubcategoryButton = buttonRect;
            }

            if (global.Categories.animationRect) {
                deps.draw.drawRoundedRectangle({
                    x: global.Categories.animationRect.x,
                    y: global.Categories.animationRect.y,
                    width: global.Categories.animationRect.width,
                    height: global.Categories.animationRect.height,
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

        // Draw background panel
        deps.draw.drawRoundedRectangle({
            x: optionX,
            y: optionY,
            width: panel.width - PADDING * 2,
            height: panel.height - PADDING * 2,
            radius: CORNER_RADIUS,
            color: CATEGORY_BOX_COLOR,
        });

        // Draw back button
        const backButtonText = 'Back';
        const backButtonX = optionX + 10;
        const backButtonY = optionY + 10;
        Renderer.drawString(
            backButtonText,
            backButtonX,
            backButtonY,
            BACK_TEXT_COLOR
        );

        // Draw item title and description
        Renderer.drawString(
            selectedItem.title,
            backButtonX,
            optionY + 30,
            CATEGORY_TITLE_COLOR,
            false
        );
        Renderer.drawString(
            selectedItem.description,
            backButtonX + 10,
            optionY + 45,
            CATEGORY_DESC_COLOR,
            false
        );

        // Draw components
        let componentY = optionY + 70;
        selectedItem.components.forEach((component) => {
            if (typeof component.draw === 'function') {
                component.x = optionX + 10;
                component.y = componentY;
                component.draw();
                componentY += 20; // rquires rework so if component is button = 20 if something else 25 etc etc
            }
        });
    };

    const draw = (mouseX, mouseY) => {
        if (global.Categories.transitionDirection !== 0) {
            const elapsed = Date.now() - global.Categories.transitionStart;
            const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
            global.Categories.transitionProgress = easeInOutQuad(rawProgress);

            if (rawProgress >= 1) {
                global.Categories.currentPage =
                    global.Categories.transitionDirection === 1
                        ? 'options'
                        : 'categories';
                global.Categories.transitionDirection = 0;
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
            let panelX = panel.x;
            if (global.Categories.transitionDirection === 1) {
                panelX -= panel.width * global.Categories.transitionProgress;
            } else if (global.Categories.transitionDirection === -1) {
                panelX -=
                    panel.width * (1 - global.Categories.transitionProgress);
            }

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
                        color: SEPARATOR_COLOR,
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
                        if (col === 0 && subcategoryItemsInRow > 0) {
                            yOffset +=
                                CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
                        }

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
                            borderColor: new Color(1, 1, 1, 0.5),
                        };

                        const isHovered = isInside(mouseX, mouseY, itemRect);
                        itemRect.color = isHovered
                            ? CATEGORY_BOX_HOVER_COLOR
                            : CATEGORY_BOX_COLOR;

                        deps.draw.drawRoundedRectangleWithBorder(itemRect);

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
                    if (col === 0 && itemIndexInRow > 0) {
                        yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
                    }

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
                        ? CATEGORY_BOX_HOVER_COLOR
                        : CATEGORY_BOX_COLOR;

                    deps.draw.drawRoundedRectangleWithGradientOutline(
                        itemRect,
                        deps.colors.gradientTop,
                        deps.colors.gradientBottom
                    );
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
        }
        if (shouldDrawOptions) {
            drawOptionsPanel(panel, mouseX, mouseY);
        }

        GL11.glDisable(GL11.GL_SCISSOR_TEST);
    };

    const handleClick = (mouseX, mouseY) => {
        if (global.Categories.transitionDirection !== 0) return;

        const wasCategoryClicked = global.Categories.categories.some(
            (cat, i) => {
                const rect = getCategoryRect(i);
                if (isInside(mouseX, mouseY, rect)) {
                    global.Categories.selected = cat.name;
                    global.Categories.currentPage = 'categories';
                    global.Categories.selectedItem = null;
                    global.Categories.selectedSubcategory = null;
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
            // Don't set to null, keep the current selection or default to Modules or smth
            // makes sure folder icon and separators remain visible
            global.Categories.selected = null;
            playClickSound();
        }

        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const panel = deps.rectangles.RightPanel;
            const backButtonText = 'Back';
            const backButtonWidth = Renderer.getStringWidth(backButtonText);
            const backButtonRect = {
                x: panel.x + PADDING + 10,
                y: panel.y + PADDING + 10,
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
            let wasComponentClicked = false;
            if (components) {
                components.forEach((component) => {
                    if (
                        typeof component.handleClick === 'function' &&
                        component.handleClick(mouseX, mouseY)
                    ) {
                        wasComponentClicked = true;
                    }
                });
            }

            if (wasComponentClicked) return;
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
            const panelWidth = panel.width - PADDING * 2;
            const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
            const itemHeight = CATEGORY_BOX_HEIGHT;
            let yOffset = panel.y + PADDING;

            if (cat.subcategories.length > 0) {
                let currentX = panel.x + PADDING;
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
                        const newSubcatName = subcat === 'All' ? null : subcat;
                        if (
                            global.Categories.selectedSubcategory !==
                            newSubcatName
                        ) {
                            const oldRect =
                                global.Categories.selectedSubcategoryButton ||
                                buttonRect;
                            global.Categories.selectedSubcategory =
                                newSubcatName;
                            rightPanelScrollY = 0;

                            // Start the animation
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
                    currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
                }
                yOffset += SUBCATEGORY_BUTTON_HEIGHT + PADDING;
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

            for (const group of itemsToDisplay) {
                if (group.type === 'separator') {
                    yOffset += SEPARATOR_HEIGHT;
                    let subcategoryItemsInRow = 0;
                    for (const item of group.items) {
                        const col = subcategoryItemsInRow % 3;
                        if (col === 0 && subcategoryItemsInRow > 0) {
                            yOffset +=
                                CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
                        }
                        const itemX =
                            panel.x +
                            PADDING +
                            col * (itemWidth + ITEM_SPACING);
                        const rect = {
                            x: itemX,
                            y: yOffset,
                            width: itemWidth,
                            height: itemHeight,
                        };
                        if (isInside(mouseX, mouseY, rect)) {
                            global.Categories.transitionDirection = 1;
                            global.Categories.transitionProgress = 0;
                            global.Categories.transitionStart = Date.now();
                            global.Categories.selectedItem = item;
                            playClickSound();
                            return;
                        }
                        subcategoryItemsInRow++;
                    }
                    const itemsInSubcategory = group.items.length;
                    const numRows = Math.ceil(itemsInSubcategory / 3);
                    yOffset +=
                        numRows > 0
                            ? CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING
                            : 0;
                } else {
                    const item = group;
                    const col = itemIndexInRow % 3;
                    if (col === 0 && itemIndexInRow > 0) {
                        yOffset += CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
                    }
                    const itemX =
                        panel.x + PADDING + col * (itemWidth + ITEM_SPACING);
                    const rect = {
                        x: itemX,
                        y: yOffset,
                        width: itemWidth,
                        height: itemHeight,
                    };
                    if (isInside(mouseX, mouseY, rect)) {
                        global.Categories.transitionDirection = 1;
                        global.Categories.transitionProgress = 0;
                        global.Categories.transitionStart = Date.now();
                        global.Categories.selectedItem = item;
                        playClickSound();
                        return;
                    }
                    itemIndexInRow++;
                }
            }
        } else if (
            global.Categories.currentPage === 'options' &&
            !isInside(mouseX, mouseY, deps.rectangles.RightPanel)
        ) {
            global.Categories.transitionDirection = -1;
            global.Categories.transitionProgress = 0;
            global.Categories.transitionStart = Date.now();
        }
    };

    const handleScroll = (mouseX, mouseY, dir) => {
        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const components = global.Categories.selectedItem.components;
            if (components) {
                components.forEach((component) => {
                    if (typeof component.handleScroll === 'function') {
                        component.handleScroll(mouseX, mouseY, dir);
                    }
                });
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

        const cat = global.Categories.selected
            ? global.Categories.categories.find(
                  (c) => c.name === global.Categories.selected
              )
            : global.Categories.categories[0];

        if (!cat) return;

        let totalContentHeight = 0;
        if (cat.subcategories.length > 0) {
            totalContentHeight += SUBCATEGORY_BUTTON_HEIGHT + PADDING;
        }

        const itemsToDisplay = global.Categories.selectedSubcategory
            ? cat.items.filter(
                  (group) =>
                      group.type === 'separator' &&
                      group.title === global.Categories.selectedSubcategory
              )
            : cat.items;

        for (const group of itemsToDisplay) {
            if (group.type === 'separator') {
                totalContentHeight += SEPARATOR_HEIGHT;
                const itemsInRows = Math.ceil(group.items.length / 3);
                totalContentHeight +=
                    itemsInRows * (CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING);
            } else {
                totalContentHeight +=
                    CATEGORY_BOX_HEIGHT + CATEGORY_BOX_PADDING;
            }
        }

        const maxScroll = Math.max(
            0,
            totalContentHeight - panel.height + PADDING
        );
        const direction = dir > 0 ? -1 : 1;
        rightPanelScrollY += direction * SCROLL_SPEED;
        rightPanelScrollY = Math.max(0, Math.min(rightPanelScrollY, maxScroll));
    };

    const handleMouseDrag = (mouseX, mouseY) => {
        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const components = global.Categories.selectedItem.components;
            if (components) {
                components.forEach((component) => {
                    if (typeof component.handleMouseDrag === 'function') {
                        component.handleMouseDrag(mouseX, mouseY);
                    }
                });
            }
        }
    };

    const handleMouseRelease = () => {
        if (
            global.Categories.currentPage === 'options' &&
            global.Categories.selectedItem
        ) {
            const components = global.Categories.selectedItem.components;
            if (components) {
                components.forEach((component) => {
                    if (typeof component.handleMouseRelease === 'function') {
                        component.handleMouseRelease();
                    }
                });
            }
        }
    };

    return {
        draw,
        handleClick,
        handleScroll,
        handleMouseDrag,
        handleMouseRelease,
    };
};
