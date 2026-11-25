const fs = require('fs');
let code = fs.readFileSync('update_combo.cjs', 'utf8');

const regex = /const replacement = \`([\s\S]*?)\`;/;
const match = code.match(regex);
if (match) {
  let text = match[1];
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') open++;
    if (text[i] === '}') open--;
  }
  console.log("Unclosed braces in replacement:", open);
}
