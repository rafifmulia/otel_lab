'use strict';

const path = require('path');
const fs = require('node:fs/promises');
// const nReadlines = require('n-readlines');
// const events = require('events');
const chokidar = require('chokidar');

// const opentelemetry = require("@opentelemetry/sdk-node");
const opentelemetry = require('@opentelemetry/api');
// const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter }  = require('@opentelemetry/sdk-metrics');


// ENUMERATIONS / CONST
const WINDOWS_PATH = '\\';
const UNIX_PATH = '/';


function timeoutPromise(cb, timeoutInMs) {
  return new Promise(async (resolve, reject) => {
    setTimeout(() => {
      resolve(cb());
    }, timeoutInMs);
  });
}


// For troubleshooting, set the log level to DiagLogLevel.DEBUG
// opentelemetry.diag.setLogger(new opentelemetry.DiagConsoleLogger(), opentelemetry.DiagLogLevel.DEBUG);

// Optionally register instrumentation libraries if using autoInstrumentation
registerInstrumentations({
  instrumentations: [],
});

/**
 * Set provider and resource name
 */
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "node-getlog",
    [SemanticResourceAttributes.SERVICE_VERSION]: "0.1.0",
  })
);
const meterProvider = new MeterProvider({
  resource: resource,
});



/**
 * Set the right exporter and processor
 */
const exporter = new OTLPMetricExporter({
  url: 'http://localhost:4318/v1/metrics',
});

meterProvider.addMetricReader(new PeriodicExportingMetricReader({
  exporter: exporter,
  exportIntervalMillis: 1000,
}));
// });
const pathLog = path.resolve('logs');
const watcher = chokidar.watch(pathLog, {ignored: /^\./, persistent: true});
watcher
  .on('add', fileAdded)
  .on('change', fileChanged)
  .on('unlink', fileRemoved)
  .on('error', fileError)
;

function fileAdded(path) {
  console.log('File', path, 'has been added');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  console.log(filename);

  if (filename === 'callng.log.2.big') {
    readWholeFileCallngLog(path);
  }
}
function fileChanged(path) {
  console.log('File', path, 'has been changed');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  if (filename === 'callng.log.2.big') {
    readUpdatedFileCallngLog(path);
  }
}
function fileRemoved(path) {
  console.log('File', path, 'has been removed');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  if (filename === 'callng.log.2.big') {
    RemovedFileCallngLog(path);
  }
}
function fileError(error) {
  console.error('Error happened', error);
}
console.log('Watching folder logs');

const lastLines = [];
function initCheckLastLine(path) {
  if (typeof lastLines[path] === undefined) lastLines[path] = 0;
}

async function readWholeFileCallngLog(path) {
  const before = process.memoryUsage().heapUsed / 1024 / 1024;
  const file = await fs.open(path);
  // const logLineRegex = /(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}) (?<host>\S+) program=(?<program>\S+), pid=(?<pid>\d+), module=(?<module>\S+), space=(?<space>\S+), action=(?<action>\S+), seshid=(?<seshid>\S+), uuid=(?<uuid>\S+), route=(?<route>\S+), sipprofile=(?<sipprofile>\S+), gateway=(?<gateway>\S+), algorithm=(?<algorithm>\S+), forceroute=(?<forceroute>\S+)/;
  // const logs = [];

  const meter = meterProvider.getMeter('counter_metrics');
  
  const inboundCallCounter = meter.createCounter('inbound_call', {
    description: 'Counter of success type',
  });

  const successCounter = meter.createCounter('success_type', {
    description: 'Counter of success type',
  });


  // const match = logLineRegex.exec(file);
  // const fields = match?.groups ?? {};
  // console.log(match);

  let lineNumber = 0;
  let lastDate = '';
  for await (const line of file.readLines()) {
    ++lineNumber;
    const cols = line.split(' ');
    // const log = {};
    // console.log(cols[0]);
    for (const key in cols) {
      let col = cols[key].replace(',', '');
      if (col.includes('inbound_call')) {
        await timeoutPromise(() => {
          console.log('ADD: inboundCallCounter.add(1);');
          inboundCallCounter.add(1);
        }, 1000);
      } else if (col.includes('SUCCESS')) {
        await timeoutPromise(() => {
          console.log('ADD: successCounter.add(1);');
          successCounter.add(1);
        }, 1000);
      }
    }
    
    // logs.push(log);
  }
  lastLines[path] = lineNumber;
  // console.log(logs);
  const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
}

async function readUpdatedFileCallngLog(path) {
  const before = process.memoryUsage().heapUsed / 1024 / 1024;
  const file = await fs.open(path);
  // const logs = [];

  const meter = meterProvider.getMeter('callng.log.2.big');
  const inboundCallCounter = meter.createCounter('inbound_call', {
    description: 'Counter of Inbound Call',
  });

  const successCounter = meter.createCounter('success_type', {
    description: 'Counter of success type',
  });

  let lineNumber = 0;
  console.log('start lastLines', lastLines);
  for await (const line of file.readLines()) {
    ++lineNumber;
    if (lastLines[path] > lineNumber) continue;

    const cols = line.split(' ');
    // const log = {};
    console.log('lineNumber', lineNumber);
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
        }   else {
            prop = propVal[0];
            val = propVal[1];
          }
      if (prop.length < 1) continue;
      // log[prop] = val;

      if (col.includes('inbound_call')) {
        await timeoutPromise(() => {
          console.log('UPDATE: inboundCallCounter.add(1);');
          inboundCallCounter.add(1);
        }, 1000);
      } else if (col.includes('SUCCESS')) {
        await timeoutPromise(() => {
          console.log('UPDATE: successCounter.add(1);');
          successCounter.add(1);
        }, 1000);
      }
       
    }
    // logs.push(log);
  }
  if (lastLines[path] < lineNumber) lastLines[path] = lineNumber;
  console.log('end lastLines', lastLines);
  // console.log(logs);
  const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
}

async function RemovedFileCallngLog(path) {
  lastLines[path] = 0;
}
  
/**
 * Example metrics
 */
// const meter = meterProvider.getMeter('example-exporter-collector');

// const requestCounter = meter.createCounter('requests', {
//   description: 'Example of a Counter',
// });

// const upDownCounter = meter.createUpDownCounter('test_up_down_counter', {
//   description: 'Example of a UpDownCounter',
// });

// const histogram = meter.createHistogram('test_histogram', {
//   description: 'Example of a Histogram',
// });

// const counter = meter.createCounter('tercounter');

// const attributes = { pid: process.pid };

// let itr = setInterval(() => {
//   requestCounter.add(1, attributes);
//   upDownCounter.add(Math.random() > 0.5 ? 1 : -1, attributes);
//   histogram.record(Math.random(), attributes);
//   counter.add(10, { 'key1': 'value1' });
// }, 1000);
// setTimeout(() => {
//   clearInterval(itr);
// }, 5010);




// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
  .then(() => console.log('Tracing terminated'))
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
