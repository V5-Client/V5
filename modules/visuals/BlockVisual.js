import RenderUtils from '../../utils/render/RendererUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { Vec3d } from '../../utils/Constants';
import { Raytrace } from '../../utils/Raytrace';

class BlockVisual extends ModuleBase {
    constructor() {
        super({
            name: 'Block Visual',
            subcategory: 'Visuals',
            description: 'renders a box where youre looking / etherwarping',
            tooltip: 'renders a box where youre looking / etherwarping',
        });

        this.RGBA = [255, 0, 0, 255];
        this.EFFECT = 'None';
        this.DRAWLINES = false;

        this.currentBlock = null;
        this.baseColor = [255, 0, 0, 255];

        this.addMultiToggle(
            'Effect',
            ['None', 'Breathing', 'Gradient'],
            true,
            (v) => {
                this.EFFECT = v.find((o) => o.enabled)?.name || 'None';
            },
            'The effect you want to use'
        );

        this.addToggle(
            'Draw Box Lines',
            (v) => {
                this.DRAWLINES = v;
            },
            'Whether or not to draw the lines of the box'
        );

        this.addColorPicker(
            'Block Color',
            java.awt.Color.RED,
            (color) => {
                this.baseColor = [color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha()];
                this.RGBA = [...this.baseColor];
            },
            'Color of the block box'
        );

        this.on('tick', () => {
            let lookingAt = Player.lookingAt();

            if (!lookingAt || lookingAt?.type?.id === 0) {
                lookingAt = Raytrace.getLookingAt(this.getDistance());
            }

            this.currentBlock = lookingAt;

            const item = Player.getHeldItem();
            const isEtherwarping = Player.isSneaking() && item?.getName()?.toLowerCase()?.includes('aspect of the void');

            if (isEtherwarping) {
                const color = this.canEtherwarp(this.currentBlock) ? [0, 255, 0] : [255, 0, 0];
                this.RGBA = [color[0], color[1], color[2], this.RGBA[3]];
            } else {
                this.RGBA = [this.baseColor[0], this.baseColor[1], this.baseColor[2], this.RGBA[3]];
            }

            this.handleEffect(isEtherwarping);
        });

        this.on('postRenderWorld', () => {
            if (!this.currentBlock || !this.RGBA) return;

            this.DRAWLINES
                ? RenderUtils.drawStyledBox(new Vec3d(this.currentBlock.x, this.currentBlock.y, this.currentBlock.z), this.RGBA, this.RGBA, 4)
                : RenderUtils.drawBox(new Vec3d(this.currentBlock.x, this.currentBlock.y, this.currentBlock.z), this.RGBA);
        });
    }

    handleEffect(isEtherwarping) {
        switch (this.EFFECT) {
            case 'Breathing':
                this.BreathingEffect();
                break;
            case 'Gradient':
                if (isEtherwarping) return;
                this.GradientEffect();
                break;
        }
    }

    BreathingEffect() {
        const alpha = (Math.sin(Date.now() * 0.004) + 1) / 2;
        this.RGBA[3] = 20 + Math.floor(alpha * 80);
    }

    GradientEffect() {
        const hue = (Date.now() % 5000) / 5000;
        const color = java.awt.Color.getHSBColor(hue, 0.8, 1);
        this.RGBA = [color.getRed(), color.getGreen(), color.getBlue(), this.RGBA[3]];
    }

    getDistance() {
        return Player.isSneaking() ? 61 : 5;
    }

    canEtherwarp(block) {
        if (!block) return false;
        const above1 = World.getBlockAt(block.x, block.y + 1, block.z);
        const above2 = World.getBlockAt(block.x, block.y + 2, block.z);
        return above1.getType().getID() === 0 && above2.getType().getID() === 0;
    }
}

new BlockVisual();
