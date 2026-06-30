const Tesseract = require('tesseract.js');
Tesseract.recognize(
  'Screenshot from 2026-06-30 13-07-29.png',
  'eng'
).then(({ data: { text } }) => {
  console.log(text);
});
