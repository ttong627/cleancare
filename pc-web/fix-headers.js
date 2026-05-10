const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      processDir(full);
    } else if (full.endsWith('page.tsx')) {
      let content = fs.readFileSync(full, 'utf8');
      let changed = false;

      const headerPatterns = [
        {
          search: 'className="mb-8 flex justify-between items-end',
          replace: 'className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0'
        },
        {
          search: 'className="mb-10 flex justify-between items-end',
          replace: 'className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0'
        },
        {
          search: 'className="flex items-center justify-between"',
          replace: 'className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0"'
        },
        {
          search: 'className="mb-8 flex justify-between items-end print:hidden"',
          replace: 'className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0 print:hidden"'
        },
        {
          search: 'className="mb-8 flex justify-between items-end border-b border-slate-200 pb-6"',
          replace: 'className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0 border-b border-slate-200 pb-6"'
        }
      ];

      for (const pattern of headerPatterns) {
        if (content.includes(pattern.search)) {
          content = content.replace(new RegExp(pattern.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), pattern.replace);
          changed = true;
        }
      }

      // Fix main container padding
      if (content.includes('className="p-8 min-h-screen flex flex-col max-w-7xl mx-auto"')) {
        content = content.replace(
          'className="p-8 min-h-screen flex flex-col max-w-7xl mx-auto"',
          'className="p-4 md:p-8 min-h-screen flex flex-col max-w-7xl mx-auto"'
        );
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(full, content);
        console.log('Updated ' + full);
      }
    }
  }
}

processDir('src/app');
