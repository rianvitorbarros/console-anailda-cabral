const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');
let open = 0;
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') open++;
    if (line[j] === '}') open--;
  }
  if (open < 0) {
    console.log("Unbalanced at line", i + 1);
    break;
  }
}
console.log("Final balance:", open);
