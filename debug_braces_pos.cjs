const fs = require('fs');
let code = fs.readFileSync('src/pages/Products.tsx', 'utf8');
let stack = [];
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') stack.push({line: i + 1, col: j + 1, text: line});
    if (line[j] === '}') stack.pop();
  }
}
for (let s of stack) {
  console.log("Unclosed at line", s.line, ":", s.text.trim());
}
