import { Button } from './Button';
import { ColorPicker } from './ColorPicker';
import { MultiToggle } from './Dropdown';
import { Separator } from './Separator';
import { PADDING } from '../Utils';

const SEPARATOR_HEIGHT = 16;
const COMPONENT_HEIGHT = 26;
const BUTTON_ONLY_HEIGHT = 24;
const DIRECT_SECTION_GAP = 8;
const DIRECT_SECTION_HEADER_HEIGHT = 26;
const DIRECT_SECTION_PADDING = 8;

export const isComponentVisible = (component) => component.visible !== false;

const getComponentExpansionHeight = (component, useExpandedHeightWhenStatic = false) => {
    if (!(component instanceof MultiToggle || component instanceof ColorPicker) || typeof component.getExpandedHeight !== 'function') {
        return 0;
    }
    if (component.animationProgress !== undefined) {
        return component.getExpandedHeight() * component.animationProgress;
    }
    return useExpandedHeightWhenStatic ? component.getExpandedHeight() : 0;
};

export const getComponentLayoutHeight = (component, useExpandedHeightWhenStatic = false) => {
    if (!isComponentVisible(component)) return 0;
    if (component instanceof Separator) return SEPARATOR_HEIGHT;
    const baseHeight =
        component.layoutHeight || (component instanceof Button && component.title === component.buttonText ? BUTTON_ONLY_HEIGHT : COMPONENT_HEIGHT);
    return baseHeight + getComponentExpansionHeight(component, useExpandedHeightWhenStatic);
};

export const getComponentHitRect = (panel, y, height, padding) => ({
    x: panel.x + padding + DIRECT_SECTION_PADDING,
    y,
    width: panel.width - 2 * (padding + DIRECT_SECTION_PADDING),
    height,
});

export const getDirectComponentX = (panel, panelX = panel.x) => panelX + PADDING + DIRECT_SECTION_PADDING;

export const getDirectComponentPanelWidth = (panel) => panel.width - DIRECT_SECTION_PADDING * 2;

export const layoutDirectComponents = (components, startY = 0, useExpandedHeightWhenStatic = false) => {
    const rows = [];
    const sections = [];
    let y = startY;
    let currentSection = null;
    let section = null;

    const closeSection = () => {
        if (!section) return;
        y += DIRECT_SECTION_PADDING;
        section.height = y - section.y;
    };

    components.filter(isComponentVisible).forEach((component, index) => {
        if (component.sectionName && component.sectionName !== currentSection) {
            closeSection();
            currentSection = component.sectionName;
            if (index > 0) y += DIRECT_SECTION_GAP;
            section = { name: currentSection, y, height: 0 };
            sections.push(section);
            y += DIRECT_SECTION_HEADER_HEIGHT;
        }

        const height = getComponentLayoutHeight(component, useExpandedHeightWhenStatic);
        rows.push({ component, y, height });
        y += height;
    });

    closeSection();
    return { rows, sections, height: y - startY };
};
