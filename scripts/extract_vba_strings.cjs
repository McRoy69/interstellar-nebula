const fs = require('fs');
const path = require('path');

const binPath = 'c:/Users/Michael.Jenni/.gemini/antigravity/playground/interstellar-nebula/temp_vba/xl/vbaProject.bin';
const outPath = 'c:/Users/Michael.Jenni/.gemini/antigravity/playground/interstellar-nebula/vba_strings.txt';

try {
    const buffer = fs.readFileSync(binPath);
    let currentString = '';
    const strings = [];

    for (let i = 0; i < buffer.length; i++) {
        const charCode = buffer[i];
        if (charCode >= 32 && charCode <= 126) {
            currentString += String.fromCharCode(charCode);
        } else {
            if (currentString.length >= 4) {
                strings.push(currentString);
            }
            currentString = '';
        }
    }

    fs.writeFileSync(outPath, strings.join('\n'));
    console.log(`Extracted ${strings.length} strings to ${outPath}`);
} catch (e) {
    console.error(e);
}
