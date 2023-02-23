'use strict';

const path = require('path');
const fs = require('node:fs/promises');
// const nReadlines = require('n-readlines');
// const events = require('events');
const chokidar = require('chokidar');
// chokidar issue: https://stackoverflow.com/questions/70615579/stop-nodejs-from-garbage-collection-automatic-closing-of-file-descriptors
const moment = require('moment');

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



// FUNCTION HELPER
function timeoutPromise(cb, timeoutInMs) {
  return new Promise(async (resolve, reject) => {
    setTimeout(() => {
      resolve(cb());
    }, timeoutInMs);
  });
}

async function forceFlushMetricWithDelay(funcCountMetric, meterProvider, delayInMs) {
  await timeoutPromise(() => {}, delayInMs);
  funcCountMetric();
  meterProvider.forceFlush();
}



/**
 * Config OpenTelemetry
 */
// For troubleshooting, set the log level to DiagLogLevel.DEBUG
opentelemetry.diag.setLogger(new opentelemetry.DiagConsoleLogger(), opentelemetry.DiagLogLevel.DEBUG);

// Optionally register instrumentation libraries if using autoInstrumentation
registerInstrumentations({
  instrumentations: [],
});

/**
 * Set provider and resource
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
 * Set the right exporter and processor(tracing) / reader(metrics)
 */
const metricOtelExporter = new OTLPMetricExporter({
  url: 'http://localhost:4318/v1/metrics',
});
const metricConsoleExporter = new ConsoleMetricExporter();

meterProvider.addMetricReader(new PeriodicExportingMetricReader({
  exporter: metricOtelExporter,
  // exportIntervalMillis: 0,
}));



/**
 * Watching folder / file
 */
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

  if (filename === 'callng.log.2.sampling') {
    readWholeFileCallngLog(path);
  }
}
function fileChanged(path) {
  console.log('File', path, 'has been changed');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  if (filename === 'callng.log.2.sampling') {
    readUpdatedFileCallngLog(path);
  }
}
function fileRemoved(path) {
  console.log('File', path, 'has been removed');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  if (filename === 'callng.log.2.sampling') {
    RemovedFileCallngLog(path);
  }
}
function fileError(error) {
  console.error('Error happened', error);
}
console.log('Watching folder logs');



/**
 * Functions for watching file / folder
 */
const lastLines = [];
function initCheckLastLine(path) {
  if (typeof lastLines[path] === undefined) lastLines[path] = 0;
}

async function readWholeFileCallngLog(path) {
  const before = process.memoryUsage().heapUsed / 1024 / 1024;
  const file = await fs.open(path);
  
  const meter = meterProvider.getMeter('callng');

  // const logLineRegex = /(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}) (?<host>\S+) program=(?<program>\S+), pid=(?<pid>\d+), module=(?<module>\S+), space=(?<space>\S+), action=(?<action>\S+), seshid=(?<seshid>\S+), uuid=(?<uuid>\S+), route=(?<route>\S+), sipprofile=(?<sipprofile>\S+), gateway=(?<gateway>\S+), algorithm=(?<algorithm>\S+), forceroute=(?<forceroute>\S+)/;
  // const logs = [];

  // const match = logLineRegex.exec(file);
  // const fields = match?.groups ?? {};
  // console.log(match);

  let lineNumber = 0;

  /**
   * Logic untuk kalkulasi inbound success dengan UpDownCounter
   */

  const mInboundCallSc = meter.createUpDownCounter('sbc_inbound_success', {
    description: 'inbound call success',
    unit: 'tps', // time per second
  });

  // used per different inbound success
  const tmpSbcInboundSc = {
    lastUnixSecond: '', // nilai terkecilnya second bukan milisecond atau dibawahnya
    cntInboundSc: 0,
  };

  for await (const line of file.readLines()) {
    ++lineNumber;
    const cols = line.split(' '); // per section

    for (const key in cols) {
      if (cols[key].length < 1) continue; // skip yang kosong
      const col = cols[key].replace(',', ''); // deny character
      const keyVal = col.split('='); // pembagian key value

      if (keyVal[0].includes('status')) {
        // status=NO_USER_RESPONSE
        // error=400
        /**
         * increment counter success inbound_call
         * 
         * ketika next stream ada status===SUCCESS
         *  cek detik, apakah di status==SUCCESS detiknya berbeda dari sebelumnya
         *  jika berbeda, maka push data yang tercumulative lalu reset data upDownCounter dengan decrement
         */
        if (keyVal[1] === 'SUCCESS') {
          const unixSecond = moment(cols[0]).unix();
          if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {
            console.log('up inbound sc', tmpSbcInboundSc.cntInboundSc);
            await forceFlushMetricWithDelay(() => {}, meterProvider, 1);

            console.log('down inbound sc');
            const timeOffSecond = (unixSecond - tmpSbcInboundSc.lastUnixSecond) * 1000;
            await forceFlushMetricWithDelay(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, meterProvider, timeOffSecond);
            tmpSbcInboundSc.lastUnixSecond = unixSecond;
            tmpSbcInboundSc.cntInboundSc = 0;
          }
          tmpSbcInboundSc.cntInboundSc++;
          mInboundCallSc.add(1);
        }
      }
    }
  }

  await forceFlushMetricWithDelay(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, meterProvider, 100);

  // performance
  lastLines[path] = lineNumber;
  const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  lineNumber = null;
}

// Gimana cara tail -f tanpa membaca keseluruhan filenya
async function readUpdatedFileCallngLog(path) {
  const before = process.memoryUsage().heapUsed / 1024 / 1024;
  const file = await fs.open(path);
  // const logs = [];

  const meter = meterProvider.getMeter('callng.log.2.sampling');
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
        // await timeoutPromise(() => {
        //   console.log('UPDATE: inboundCallCounter.add(1);');
        //   inboundCallCounter.add(1);
        // }, 1000);
      } else if (col.includes('SUCCESS')) {
        // await timeoutPromise(() => {
        //   console.log('UPDATE: successCounter.add(1);');
        //   successCounter.add(1);
        // }, 1000);
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



// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
  .then(() => console.log('Tracing terminated'))
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
