const SoundCategory = net.minecraft.sound.SoundCategory;
const Identifier = net.minecraft.util.Identifier;
const SoundEvent = net.minecraft.sound.SoundEvent;

const JINGLE_BELLS = [
    12, 12, 12, 12, 12, 12, 12, 15, 8, 10, 12, 13, 13, 13, 13, 13, 12, 12, 12, 12, 10, 10, 12, 10, 15, 12, 12, 12, 12, 12, 12, 12, 15, 8, 10, 12, 13, 13, 13,
    13, 13, 12, 12, 12, 15, 15, 13, 10, 8,
];

let jingleIndex = 0;

export const playClickSound = () => {
    const entry = JINGLE_BELLS[jingleIndex];

    const playNote = (note) => {
        const noteblockNote = note % 25;
        const pitch = Math.pow(2, (noteblockNote - 12) / 12);
        World.getWorld().playSoundClient(SoundEvent.of(Identifier.of('minecraft', 'block.note_block.pling')), SoundCategory.MASTER, 0.5, pitch);
    };

    if (Array.isArray(entry)) {
        entry.forEach(playNote);
    } else {
        playNote(entry);
    }

    jingleIndex = (jingleIndex + 1) % JINGLE_BELLS.length;
};
