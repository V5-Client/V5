// Client Version + Title (This is kinda useless ngl since Minecraft* 1.21.5 overrides it for some reason)
global.Version = '1.0.0';
global.SESSION_SERVER_HASH = java.util.UUID.randomUUID()
    .toString()
    .replaceAll('-', '');

Client.getMinecraft()
    .getWindow()
    .setTitle('Client ' + global.Version + ` - ${Player.getName()}`);

/* FAILSAFES */

/* GUI */
import './GUI/GUI.js';
import './Utility/Config.js';

/* FORAGING */
//import './Modules/Foraging/SeaLumieMacro.js';

/* MINING */
import './Modules/Mining/PinglessMining.js';
import './Modules/Mining/Nuker.js';
//import './Modules/Mining/CommissionMacro.js'; zurviq can fix whenever
import './Modules/Mining/GemstoneMacro.js';

/* VISUALS */
import './Modules/Visuals/Xray.js';
import './Modules/Visuals/MobHider.js';

/* SKILLS */
import './Modules/Skills/AutoHarp.js';
//import './Modules/Skills/BeachBaller.js'; some retard completely ruined beach ball macro i think, or im just being a retard but its hella broken
import './Modules/Skills/FishingMacro.js';
import './Modules/Other/Visual.js'; // this is just for me cus i need - zurv
import './Modules/Skills/RouteWalker.js';

/* OTHER */
import './Pathfinding/Pathwalker.js';
import './Modules/Other/DiscordRPC.js';
import './Modules/Other/FastPlace.js';
//import './Modules/Other/Freelook.js';
import './Utility/Misc.js';
import './Backend/IRC.js';
// import "./Utility/Webhooks.js"; i honestly fucking hate the webhook load message so much, it just spams me.

/* TESTING */
import './TestNotification.js'; //REMOVE BEFORE RELEASE
import './RAYTRACEDEBUG.js'; // REMOVE BEFORE RELEASE

import { loadSettings } from './GUI/GuiSave';
loadSettings();
import { returnDiscord } from './GUI/Utils.js';
returnDiscord();

/* Mixins */
import {
    fullStainedGlassPane,
    fullPickle,
    emptyKelp,
    emptyGrass,
    emptyTallGrass,
} from './mixins.js';

function attachMixin(mixin, name, callback) {
    try {
        mixin.attach(callback);
    } catch (e) {
        global.showNotification(`Failed to attach ${name}`, e, 'ERROR');
    }
}

attachMixin(fullStainedGlassPane, 'fullStainedGlassPane', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    const StainedGlassPaneBlock = net.minecraft.block.StainedGlassPaneBlock;

    if (instance instanceof StainedGlassPaneBlock) {
        cir.setReturnValue(VoxelShapes.fullCube());
    }
});

attachMixin(fullPickle, 'fullPickle', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    cir.setReturnValue(VoxelShapes.fullCube());
});

attachMixin(emptyKelp, 'emptyKelp', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    const KelpBlock = net.minecraft.block.KelpBlock;
    const KelpPlant = net.minecraft.block.KelpPlantBlock;

    if (instance instanceof KelpBlock || instance instanceof KelpPlant) {
        cir.setReturnValue(VoxelShapes.empty());
    }
});

attachMixin(emptyGrass, 'emptyGrass', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    cir.setReturnValue(VoxelShapes.empty());
});

attachMixin(emptyTallGrass, 'emptyTallGrass', (instance, cir) => {
    const VoxelShapes = net.minecraft.util.shape.VoxelShapes;
    cir.setReturnValue(VoxelShapes.empty());
});
