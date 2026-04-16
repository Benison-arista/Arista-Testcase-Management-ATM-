const XLSX = require('xlsx');
const wb = XLSX.readFile('/Users/benison.rajan-babu/Downloads/VEL-VeloCloud SD-WAN-Test Case-Master_list.xlsx');
const ws = wb.Sheets['Test Cases'];
const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

// Multiple rows per TC (one per test step). Count unique TCs by Name_1 (qtest ID like TC-45868)
const uniqueTCs = new Set(data.map(r => r.Name_1));
console.log('Total rows:', data.length);
console.log('Unique test cases (by Name_1/TC-ID):', uniqueTCs.size);
console.log();

// Analyze Module and Section values
const modules = {};
data.forEach(r => {
  const mod = r.Module || '(empty)';
  if (!modules[mod]) modules[mod] = new Set();
  modules[mod].add(r.Section || '(empty)');
});

console.log('=== Module -> Section hierarchy ===');
const sorted = Object.entries(modules).sort((a, b) => b[1].size - a[1].size);
console.log('Total unique Module values:', sorted.length);
console.log();
// Show top 25 modules with their sections
for (const [mod, sections] of sorted.slice(0, 25)) {
  const secArr = [...sections];
  const secList = secArr.slice(0, 5).join(', ');
  const more = sections.size > 5 ? ' ... (+' + (sections.size - 5) + ' more)' : '';
  console.log('  ' + mod + ': [' + sections.size + ' sections] ' + secList + more);
}
if (sorted.length > 25) console.log('  ... +' + (sorted.length - 25) + ' more modules');

// Check how many rows have empty Module
const emptyModule = data.filter(r => !r.Module.trim()).length;
console.log();
console.log('Rows with empty Module:', emptyModule);

// Check for Dataplane module specifically
const dpModules = sorted.filter(([m]) => {
  const lower = m.toLowerCase();
  return lower.includes('dataplane') || lower.includes('data_plane') || lower.includes('data plane');
});
console.log();
console.log('Modules matching "dataplane":');
for (const [m, s] of dpModules) {
  console.log('  ' + m + ' (' + s.size + ' sections): ' + [...s].join(', '));
}

// Check Module naming pattern - strip "MD-XXXX " prefix
console.log();
console.log('=== Module name pattern ===');
const modNames = Object.keys(modules);
const withPrefix = modNames.filter(m => /^MD-\d+\s/.test(m));
console.log('Modules with MD-XXXX prefix:', withPrefix.length, 'out of', modNames.length);
console.log('Sample (first 5):');
for (const m of withPrefix.slice(0, 5)) {
  const stripped = m.replace(/^MD-\d+\s+/, '');
  console.log('  "' + m + '" -> "' + stripped + '"');
}
