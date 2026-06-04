import instrumentIndexToName from './instrument-index-to-name';
export default function createNoteMap(sequence) {
    const map = [];
    for (let i = 0; i < sequence.tracks.length; i++)
        map.push([]);
    let currentInstrument = instrumentIndexToName[0];
    sequence.tracks.forEach((track, i) => {
        track.forEach((ev) => {
            switch (ev.cmd) {
                case "note":
                    const inst = ev.instrument !== undefined ? instrumentIndexToName[ev.instrument] : currentInstrument;
                    if (ev.duration > 0) {
                        let gap = ev.gap ? ev.gap : 0;
                        const len = ev.duration;
                        gap = Math.min(gap, len * 2 / 3);
                        const obj = {
                            pitch: ev.pitch,
                            instrument: inst,
                            start: Math.round((ev.start) * 1000000) / 1000000,
                            end: Math.round((ev.start + len - gap) * 1000000) / 1000000,
                            volume: ev.volume
                        };
                        if (ev.startChar)
                            obj.startChar = ev.startChar;
                        if (ev.endChar)
                            obj.endChar = ev.endChar;
                        if (ev.style)
                            obj.style = ev.style;
                        if (ev.cents)
                            obj.cents = ev.cents;
                        map[i].push(obj);
                    }
                    break;
                case "program":
                    currentInstrument = instrumentIndexToName[ev.instrument];
                    break;
                case "text":
                    break;
                default:
                    console.log("Unhandled midi event", ev);
            }
        });
    });
    return map;
}
