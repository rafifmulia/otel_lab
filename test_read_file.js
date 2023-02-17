'use strict';

const path = require('path');
const fs = require('node:fs/promises');

/**
 * Read File using node:fs/promises => read per line
 */
async function readFile0(path) {
  if (path.length < 1) return;
  const before = process.memoryUsage().heapUsed / 1024 / 1024;
  const file = await fs.open(path);

  let lineNumber = 0;
  for await (const line of file.readLines()) {
    ++lineNumber;
    const cols = line.split(' ');
    // const log = {};

    for (const key in cols) {
      let col = cols[key].replace(',', '');
      let propVal = col.split('=');
      let prop, val = '';
      if (key === '0') {
        prop = 'date';
        val = propVal[0];
      } else if (key === '1') {
        prop = 'host';
        val = propVal[0];
      } else {
        prop = propVal[0];
        val = propVal[1];
      }
      if (prop.length < 1) continue;
      // log[prop] = val;

      if (col.includes('inbound_call')) console.log('inbound_call', lineNumber);
    }
  }
  const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
}



readFile0(path.resolve('logs', 'callng.log.2.big'));



// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
  .then(() => console.log('Tracing terminated'))
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
