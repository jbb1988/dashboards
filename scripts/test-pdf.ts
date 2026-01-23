import * as fs from 'fs';
const pdfParse = require('pdf-parse');

async function test() {
  const dir = '/Users/jbb/Library/CloudStorage/OneDrive-MARSCompany/Contract Files/AI Training Contracts';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).slice(0, 5);

  for (const file of files) {
    const filePath = `${dir}/${file}`;
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      const textLen = data.text?.length || 0;
      const shortName = file.length > 40 ? file.substring(0, 37) + '...' : file;
      console.log(`${shortName.padEnd(40)} : ${textLen} chars`);
      if (textLen > 0) {
        console.log(`  First 200 chars: ${data.text.substring(0, 200).replace(/\n/g, ' ')}`);
      }
    } catch (e: any) {
      console.log(`${file.substring(0, 40).padEnd(40)} : ERROR - ${e.message?.substring(0, 50)}`);
    }
  }
}
test();
