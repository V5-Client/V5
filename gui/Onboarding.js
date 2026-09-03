import { Categories } from './categories/CategorySystem';
import { getCategoryRect } from './categories/CategoryRenderer';
import { Button } from './components/Button';
import { ToggleButton } from './components/Toggle';
import { saveSettings } from './GuiSave';
import { FontSizes, PADDING, THEME, colorWithAlpha, drawRect, drawRoundedRectangleWithBorder, drawText } from './Utils';
import { GuiRectangles, GuiState } from './core/GuiState';

const STEPS = [
    ['Welcome to V5', ['Here is a quick tour of the client.', 'You can revisit everything from the sidebar.']],
    ['Dashboard', ['See active modules and session information', 'at a glance.'], 'Dashboard'],
    ['Modules', ['Browse modules, configure them, and open', 'their documentation.'], 'Modules'],
    ['Settings', ['Configure shared behavior, failsafes,', 'and your V5 profile.'], 'Settings'],
    ['Theme', ['Adjust the GUI colors and layout', 'without changing module behavior.'], 'Theme'],
    ['Privacy & safety', ['Choose what V5 may send and what happens on a ban.']],
];

const nextButton = new Button('', 0, 0, 'Next', null, { showContainer: false });
const skipButton = new Button('', 0, 0, 'Skip', null, { showContainer: false });
const telemetryToggle = new ToggleButton('Ban telemetry', 0, 0);
const statisticsToggle = new ToggleButton('Anonymous statistics', 0, 0);
const clippingToggle = new ToggleButton('Clip on ban', 0, 0);
let step = 0;
let active = false;

const getSettingToggle = (title) =>
    Categories.categories.find((category) => category.name === 'Settings')?.directComponents?.find((component) => component.title === title);

const finish = (applyPreferences = false) => {
    if (applyPreferences) {
        [
            ['Ban telemetry', telemetryToggle],
            ['Clip on ban', clippingToggle],
        ].forEach(([title, source]) => {
            const target = getSettingToggle(title);
            if (!target) return;
            target.enabled = source.enabled;
            target.animationProgress = source.enabled ? 1 : 0;
            target.callback?.(source.enabled);
        });
        Config.setSendStatistics(statisticsToggle.enabled);
        saveSettings();
    }
    Config.markWelcomeShown();
    active = false;
};

const open = () => {
    active = !Config.wasWelcomeShown();
    step = 0;
    if (!active) return;
    telemetryToggle.enabled = getSettingToggle('Ban telemetry')?.enabled ?? true;
    statisticsToggle.enabled = Config.getSendStatistics();
    clippingToggle.enabled = getSettingToggle('Clip on ban')?.enabled ?? true;
    telemetryToggle.animationProgress = telemetryToggle.enabled ? 1 : 0;
    statisticsToggle.animationProgress = statisticsToggle.enabled ? 1 : 0;
    clippingToggle.animationProgress = clippingToggle.enabled ? 1 : 0;
};

const draw = (mouseX, mouseY) => {
    if (!active) return;

    const current = STEPS[step];
    const panel = GuiRectangles.RightPanel;
    const preferences = step === STEPS.length - 1;
    const width = Math.min(320, panel.width - PADDING * 4);
    const height = preferences ? 138 : 112;
    const x = panel.x + (panel.width - width) / 2;
    const y = panel.y + (panel.height - height) / 2;

    drawRect({ x: 0, y: 0, width: GuiState.getGuiWidth(), height: GuiState.getGuiHeight(), color: 0xaa000000 });

    if (current[2]) {
        const index = Categories.getVisibleCategories().findIndex((category) => category.name === current[2]);
        if (index !== -1) {
            drawRoundedRectangleWithBorder({
                ...getCategoryRect(index),
                radius: 8,
                color: colorWithAlpha(THEME.ACCENT, 0.22),
                borderWidth: 2,
                borderColor: THEME.ACCENT,
            });
        }
    }

    drawRoundedRectangleWithBorder({ x, y, width, height, radius: 12, color: THEME.BG_WINDOW, borderWidth: 1, borderColor: THEME.BORDER });
    drawText(current[0], x + 16, y + (preferences ? 16 : 20), FontSizes.HEADER, THEME.TEXT);
    current[1].forEach((line, index) => drawText(line, x + 16, y + (preferences ? 30 : 40) + index * 11, FontSizes.REGULAR, THEME.TEXT_MUTED));

    if (preferences) {
        [telemetryToggle, statisticsToggle, clippingToggle].forEach((toggle, index) => {
            toggle.x = x + 16;
            toggle.y = y + 40 + index * 24;
            toggle.optionPanelWidth = width - 16;
            toggle.draw(mouseX, mouseY);
        });
    }

    skipButton.x = x + 16;
    skipButton.y = y + height - 24;
    skipButton.draw(mouseX, mouseY);
    nextButton.setButtonText(preferences ? 'Finish' : 'Next');
    nextButton.x = x + width - 80;
    nextButton.y = y + height - 24;
    nextButton.draw(mouseX, mouseY);
};

const handleClick = (mouseX, mouseY) => {
    if (!active) return false;
    if (
        step === STEPS.length - 1 &&
        (telemetryToggle.handleClick(mouseX, mouseY) || statisticsToggle.handleClick(mouseX, mouseY) || clippingToggle.handleClick(mouseX, mouseY))
    )
        return true;
    if (skipButton.handleClick(mouseX, mouseY)) finish();
    else if (nextButton.handleClick(mouseX, mouseY)) {
        if (step === STEPS.length - 1) finish(true);
        else step++;
    }
    return true;
};

export const onboarding = { open, draw, handleClick, isActive: () => active };
