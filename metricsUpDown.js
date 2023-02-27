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
    const timeout = setTimeout(() => {
      resolve(cb());
      clearTimeout(timeout);
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
// opentelemetry.diag.setLogger(new opentelemetry.DiagConsoleLogger(), opentelemetry.DiagLogLevel.DEBUG);

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
  // views
});



/**
 * Set the right exporter and processor(tracing) / reader(metrics)
 */
const metricOtelExporter = new OTLPMetricExporter({
  url: 'http://localhost:4318/v1/metrics',
});
const metricConsoleExporter = new ConsoleMetricExporter();

meterProvider.addMetricReader(new PeriodicExportingMetricReader({
  exporter: metricOtelExporter, // kirim ke OTLP Protocol
  // exporter: metricConsoleExporter, // untuk debugging bentuk metric yang akan diexport
  // exportIntervalMillis: 0, // kalo dicomment defaultnya 60second, gimana cara deactivatenya ?
  // exportIntervalMillis: 999999999, // 32-bit signed integer => gawork kecepetan
  // exportIntervalMillis: 999999999, // maximum angaka 9-nya 9 digit
  exportIntervalMillis: 1000,
  // exportTimeoutMillis: 1000,
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
    removedFileCallngLog(path);
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

  // const logLineRegex = /(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}) (?<host>\S+) program=(?<program>\S+), pid=(?<pid>\d+), module=(?<module>\S+), space=(?<space>\S+), action=(?<action>\S+), seshid=(?<seshid>\S+), uuid=(?<uuid>\S+), route=(?<route>\S+), sipprofile=(?<sipprofile>\S+), gateway=(?<gateway>\S+), algorithm=(?<algorithm>\S+), forceroute=(?<forceroute>\S+)/;
  // const logs = [];

  // const match = logLineRegex.exec(file);
  // const fields = match?.groups ?? {};
  // console.log(match);

  // await readWholeFileCallngLogWithSyncUpDownCounter(path);
  await readWholeFileCallngLogWithAsyncUpDownCounter(path);

  // performance
  const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
  console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
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

async function removedFileCallngLog(path) {
  lastLines[path] = 0;
}


/**
 * Set periodic metric exporter
 *  Interval: anytime
 */
async function readWholeFileCallngLogWithSyncUpDownCounter(path) {
  const file = await fs.open(path);
  
  const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

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
         * Logic untuk kalkulasi inbound success dengan UpDownCounter
         * 
         * ketika next stream ada status===SUCCESS
         *  cek detik, apakah di status==SUCCESS detiknya berbeda dari sebelumnya
         *  jika berbeda, maka push data yang tercumulative lalu reset data upDownCounter dengan decrement
         */
        if (keyVal[1] === 'SUCCESS') {
          const unixSecond = moment(cols[0]).unix();
          if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {
            console.log('up inbound sc', tmpSbcInboundSc.cntInboundSc);

            console.log('down inbound sc', Number('-' + tmpSbcInboundSc.cntInboundSc));
            const timeOffSecond = (unixSecond - tmpSbcInboundSc.lastUnixSecond) * 1000; // convert to milisecond
            await forceFlushMetricWithDelay(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, meterProvider, timeOffSecond);
            // await timeoutPromise(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, timeOffSecond);
            tmpSbcInboundSc.lastUnixSecond = unixSecond;
            tmpSbcInboundSc.cntInboundSc = 0;
          }
          tmpSbcInboundSc.cntInboundSc++;
          mInboundCallSc.add(1);
        }
      }
    }
  }

  // mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));
  await forceFlushMetricWithDelay(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, meterProvider, 100);

  lastLines[path] = lineNumber;
  lineNumber = null;
}
/**
 * Set periodic metric exporter
 *  Interval: 1000
 */
async function readWholeFileCallngLogWithAsyncUpDownCounter(path) {
  const file = await fs.open(path);
  
  const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

  const mInboundCallSc = meter.createObservableUpDownCounter('sbc_inbound_success', {
    description: 'inbound call success',
    unit: 'tps', // time per second
  });

  // used per different inbound success
  const tmpSbcInboundSc = {
    lastUnixSecond: '', // nilai terkecilnya second bukan milisecond atau dibawahnya
    cntInboundSc: 0,
    tmpCntInboundSc: 0,
  };

  mInboundCallSc.addCallback(function(observableResult) {
    console.log('observer', tmpSbcInboundSc.cntInboundSc);
    observableResult.observe(tmpSbcInboundSc.cntInboundSc);
    tmpSbcInboundSc.cntInboundSc = 0;
  });

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
         * Logic untuk kalkulasi inbound success dengan UpDownCounter
         * 
         * ketika next stream ada status===SUCCESS
         *  cek detik, apakah di status==SUCCESS detiknya berbeda dari sebelumnya
         *  jika berbeda, maka push data yang tercumulative lalu reset data upDownCounter dengan decrement
         */
        if (keyVal[1] === 'SUCCESS') {
          const unixSecond = moment(cols[0]).unix();
          if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {
            const timeOffSecond = (unixSecond - tmpSbcInboundSc.lastUnixSecond) * 1000; // convert to milisecond
            await timeoutPromise(() => {tmpSbcInboundSc.cntInboundSc = tmpSbcInboundSc.tmpCntInboundSc;}, timeOffSecond);
            console.log('after delay', tmpSbcInboundSc.cntInboundSc);
            tmpSbcInboundSc.lastUnixSecond = unixSecond;
            tmpSbcInboundSc.tmpCntInboundSc = 0;
          }
          tmpSbcInboundSc.tmpCntInboundSc++;
        }
      }
    }
  }

  lastLines[path] = lineNumber;
  lineNumber = null;
}



// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  meterProvider.shutdown()
  .then(async () => {console.log('Tracing terminated'); })
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
