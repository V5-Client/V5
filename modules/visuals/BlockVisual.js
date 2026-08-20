import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { getLookingAt } from '../../utils/Raytrace';

class BlockVisual extends ModuleBase {
    constructor() {
        super({
            name: 'modules.block_visual.name',
            subcategory: 'Visuals',
            description: 'modules.block_visual.description',
            tooltip: 'modules.block_visual.tooltip',
        });

        this.baseColor = new RenderColor(255, 0, 0, 255);
        this.RGBA = new RenderColor(255, 0, 0, 255);
        this.EFFECT = 'None';
        this.DRAWLINES = false;
        this.currentBlock = null;

        this.addMultiToggle(
            'labels.effect',
            ['options.none', 'options.breathing', 'options.gradient'],
            true,
            (v) => {
                this.EFFECT = v.find((o) => o.enabled)?.name || 'None';
            },
            'The effect you want to use'
        );

        this.addToggle(
            'labels.draw_box_lines',
            (v) => {
                this.DRAWLINES = v;
            },
            'descriptions.draw_box_lines'
        );

        this.addColorPicker(
            'labels.block_color',
            java.awt.Color.RED,
            (color) => {
                this.baseColor = new RenderColor(color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha());
                this.RGBA = this.baseColor;
            },
            'descriptions.block_color'
        );

        this.on('tick', () => {
            let lookingAt = Player.lookingAt();
            if (lookingAt instanceof Entity) lookingAt = null;

            if (!lookingAt || lookingAt?.type?.id === 0) {
                lookingAt = getLookingAt(this.getDistance());
            }

            this.currentBlock = lookingAt;

            const item = Player.getHeldItem();
            const itemName = item?.getName()?.toLowerCase();
            const isEtherwarping = Player.isSneaking() && (itemName?.includes('aspect of the void') || itemName?.includes('aspect of the end'));

            const currentAlpha = this.RGBA ? this.RGBA.a : 255;

            if (isEtherwarping) {
                const canWarp = this.canEtherwarp(this.currentBlock);
                this.RGBA = new RenderColor(canWarp ? 0 : 255, canWarp ? 255 : 0, 0, currentAlpha);
            } else {
                this.RGBA = new RenderColor(this.baseColor.r, this.baseColor.g, this.baseColor.b, currentAlpha);
            }

            this.handleEffect(isEtherwarping);
        });

        this.on('postRenderWorld', () => {
            if (!this.currentBlock || !this.RGBA) return;

            const pos = new Vec3d(this.currentBlock.x, this.currentBlock.y, this.currentBlock.z);

            this.DRAWLINES ? Render3D.drawStyledBox(pos, this.RGBA, this.RGBA, 4) : Render3D.drawFilledBox(pos, this.RGBA);
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
        const newA = Math.floor(20 + alpha * 80);
        this.RGBA = new RenderColor(this.RGBA.r, this.RGBA.g, this.RGBA.b, newA);
    }

    GradientEffect() {
        const hue = (Date.now() % 5000) / 5000;
        const color = java.awt.Color.getHSBColor(hue, 0.8, 1);
        this.RGBA = new RenderColor(color.getRed(), color.getGreen(), color.getBlue(), this.RGBA.a);
    }

    getDistance() {
        return Player.isSneaking() ? 61 : 5;
    }

    canEtherwarp(block) {
        if (!block) return false;
        const above1 = World.getBlockAt(block.x, block.y + 1, block.z);
        const above2 = World.getBlockAt(block.x, block.y + 2, block.z);
        return !!above1 && !!above2 && above1.getType().getID() === 0 && above2.getType().getID() === 0;
    }
}

new BlockVisual();
