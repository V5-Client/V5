import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Raytrace } from '../../utils/Raytrace';
import Render from '../../utils/render/Render';

class BlockVisual extends ModuleBase {
    constructor() {
        super({
            name: 'Block Visual',
            subcategory: 'Visuals',
            description: 'renders a box where youre looking / etherwarping',
            tooltip: 'renders a box where youre looking / etherwarping',
        });

        this.baseColor = Render.Color(255, 0, 0, 255);
        this.RGBA = Render.Color(255, 0, 0, 255);
        this.EFFECT = 'None';
        this.DRAWLINES = false;
        this.currentBlock = null;

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
                this.baseColor = Render.Color(color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha());
                this.RGBA = this.baseColor;
            },
            'Color of the block box'
        );

        this.on('tick', () => {
            let lookingAt = Player.lookingAt();
            if (lookingAt instanceof Entity) lookingAt = null;

            if (!lookingAt || lookingAt?.type?.id === 0) {
                lookingAt = Raytrace.getLookingAt(this.getDistance());
            }

            this.currentBlock = lookingAt;

            const item = Player.getHeldItem();
            const isEtherwarping = Player.isSneaking() && item?.getName()?.toLowerCase()?.includes('aspect of the void');

            const currentAlpha = this.RGBA ? this.RGBA.a : 255;

            if (isEtherwarping) {
                const canWarp = this.canEtherwarp(this.currentBlock);
                this.RGBA = Render.Color(canWarp ? 0 : 255, canWarp ? 255 : 0, 0, currentAlpha);
            } else {
                this.RGBA = Render.Color(this.baseColor.r, this.baseColor.g, this.baseColor.b, currentAlpha);
            }

            this.handleEffect(isEtherwarping);
        });

        this.on('postRenderWorld', () => {
            if (!this.currentBlock || !this.RGBA) return;

            const pos = new Vec3d(this.currentBlock.x, this.currentBlock.y, this.currentBlock.z);

            this.DRAWLINES ? Render.drawStyledBox(pos, this.RGBA, this.RGBA, 4) : Render.drawBox(pos, this.RGBA);
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
        this.RGBA = Render.Color(this.RGBA.r, this.RGBA.g, this.RGBA.b, newA);
    }

    GradientEffect() {
        const hue = (Date.now() % 5000) / 5000;
        const color = java.awt.Color.getHSBColor(hue, 0.8, 1);
        this.RGBA = Render.Color(color.getRed(), color.getGreen(), color.getBlue(), this.RGBA.a);
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
