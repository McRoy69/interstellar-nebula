const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../src/data/realData.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Operator mapping provided by the user
const operatorMapping = {
    '1': 'Javier Lucar',             // Brünieren
    '2': 'Walter Landmeier',         // QPQ  
    '3': 'Nazmi Özkan',              // Armoloy
    '4': 'Thilakshan Atputharasa',   // Plasmanitrieren
    '5': 'Kiruvakaran Sivalingam',   // INDH
    '6': 'David Born',               // Vakuumhärten
    '7': 'Semir Adilic',             // Härten
};

data.forEach(dept => {
    if (operatorMapping[dept.id]) {
        dept.verantwortlicher = operatorMapping[dept.id];
    }
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('Updated verantwortlicher for', data.length, 'departments:');
data.forEach(d => console.log(`  ${d.id}: ${d.name} -> ${d.verantwortlicher}`));
