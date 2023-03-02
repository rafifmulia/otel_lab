'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('node:fs/promises');
// const nReadlines = require('n-readlines');
// const events = require('events');
const chokidar = require('chokidar');
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
    if (timeoutInMs >= 1675695600) {
      console.error('(node:22082) TimeoutOverflowWarning: 1675695600000 does not fit into a 32-bit signed integer | Auto Set timeoutInMs to 0');
      timeoutInMs = 0;
    }
    const timeout = setTimeout(() => {
      resolve(cb());
      clearTimeout(timeout);
    }, timeoutInMs);
  });
}

async function forceFlushMetricWithDelay(funcCountMetric, meterProvider, delayInMs) {
  if (delayInMs >= 1675695600) {
    console.error('(node:22082) TimeoutOverflowWarning: 1675695600000 does not fit into a 32-bit signed integer | Auto Set delayInMs to 0');
    delayInMs = 0;
  }
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

  if (filename === 'callng.log') {
    readWholeFileCallngLog(path);
  }
}
function fileChanged(path) {
  console.log('File', path, 'has been changed');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  if (filename === 'callng.log') {
    readUpdatedFileCallngLog(path);
  }
}
function fileRemoved(path) {
  console.log('File', path, 'has been removed');
  initCheckLastLine(path);

  const split = path.split(UNIX_PATH);
  const filename = split[split.length-1];
  if (filename === 'callng.log') {
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
  // const before = process.memoryUsage().heapUsed / 1024 / 1024;

  // const logLineRegex = /(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+\d{2}:\d{2}) (?<host>\S+) program=(?<program>\S+), pid=(?<pid>\d+), module=(?<module>\S+), space=(?<space>\S+), action=(?<action>\S+), seshid=(?<seshid>\S+), uuid=(?<uuid>\S+), route=(?<route>\S+), sipprofile=(?<sipprofile>\S+), gateway=(?<gateway>\S+), algorithm=(?<algorithm>\S+), forceroute=(?<forceroute>\S+)/;
  // const logs = [];

  // const match = logLineRegex.exec(file);
  // const fields = match?.groups ?? {};
  // console.log(match);

  const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  readWholeFileCallngLogWithSyncCounterMonotonic(path, meter);
  readWholeFileCallngLogWithAsyncCounterMonotonic(path, meter);
  readWholeFileCallngLogWithSyncUpDownCounter(path, meter);
  readWholeFileCallngLogWithAsyncUpDownCounter(path, meter);
  readWholeFileCallngLogSuccessRate(path, meter);

  // performance
  // const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
  // console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
}

// Gimana cara tail -f tanpa membaca keseluruhan filenya
async function readUpdatedFileCallngLog(path) {
  const before = process.memoryUsage().heapUsed / 1024 / 1024;
  const file = await fs.open(path);
  // const logs = [];

  const meter = meterProvider.getMeter('callng');
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
 * Case: Total SBC All Inbound Call
 * Intrumentation: Synchronous Counter
 * Selected Aggregation: Sum Aggregation
 * Aggregation Temporality: Cumulative
 * Desc: when invoked, if the variable not increased, the result will increase
 * Ex: when observer(1) then observer(1), again and again. The result will be 0 to 1, 1 to 2, 2 to 3, ...
 * Config:
 *  Set periodic metric exporter
 *    Interval: 1000 ms
 */
async function readWholeFileCallngLogWithSyncCounterMonotonic(path, meter) {
  const file = await fs.open(path);
  
  // const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

  const mInboundCallSc = meter.createCounter('sbc_inbound_all_total_synccounter', {
    description: 'total inbound call success',
    unit: 'total',
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

      if (keyVal[0].includes('action')) {
        if (keyVal[1] === 'inbound_call') {
          // const unixSecond = moment(cols[0]).unix();
          // if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {}
          await timeoutPromise(() => {mInboundCallSc.add(1);}, 1000);
          // await forceFlushMetricWithDelay(() => {mInboundCallSc.add(1);}, meterProvider, 1000);
          console.log('lineNumber', lineNumber);
        }
      }
    }
  }

  lastLines[path] = lineNumber;
  lineNumber = null;
  file.close();
}
/**
 * Case: Total SBC Inbound Call Success
 * Intrumentation: Asynchronous Counter
 * Selected Aggregation: Sum Aggregation
 * Aggregation Temporality: Cumulative
 * Desc: when invoked, if the variable not increased, the result still same
 * Ex: when observer(1) then observer(1), again and again. The result will be 0 to 1, 1 to 1, 1 to 1, ...
 * Config:
 *  Set periodic metric exporter
 *    Interval: 1000 ms
 */
async function readWholeFileCallngLogWithAsyncCounterMonotonic(path, meter) {
  const file = await fs.open(path);
  
  // const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

  const mInboundCallSc = meter.createObservableCounter('sbc_inbound_success_total_asynccounter', {
    description: 'total inbound call success',
    unit: 'total',
  });

  // used per different inbound success
  const tmpSbcInboundSc = {
    lastUnixSecond: '', // nilai terkecilnya second bukan milisecond atau dibawahnya
    cntInboundSc: 0,
  };

  mInboundCallSc.addCallback(function(observableResult) {
    console.log('observable', tmpSbcInboundSc.cntInboundSc);
    observableResult.observe(tmpSbcInboundSc.cntInboundSc);
  });

  for await (const line of file.readLines()) {
    ++lineNumber;
    const cols = line.split(' '); // per section

    for (const key in cols) {
      if (cols[key].length < 1) continue; // skip yang kosong
      const col = cols[key].replace(',', ''); // deny character
      const keyVal = col.split('='); // pembagian key value

      if (keyVal[0].includes('status')) {
        if (keyVal[1] === 'SUCCESS') {
          // const unixSecond = moment(cols[0]).unix();
          // if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {}
          tmpSbcInboundSc.cntInboundSc++;
        }
      }
    }
  }

  lastLines[path] = lineNumber;
  lineNumber = null;
  file.close();
}
/**
 * Case: Active SBC Inbound Call
 * Instrumentation: Synchronous UpDownCounter
 * Selected Aggregation: Sum Aggregation
 * Aggregation Temporality: Cumulative
 * Desc: increment and decrement(manually)
 * Ex: when add(5) then add(7), the result will be 0 to 5, 5 to 12 (*bcs added 7)
 * Config:
 *  Set periodic metric exporter
 *    Interval: 1000 ms
 */
async function readWholeFileCallngLogWithSyncUpDownCounter(path, meter) {
  const file = await fs.open(path);
  
  // const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

  const mInboundCallSc = meter.createUpDownCounter('sbc_inbound_active_syncupdowncounter', {
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
    const unixSecond = moment(cols[0]).unix();

    for (const key in cols) {
      if (cols[key].length < 1) continue; // skip yang kosong
      const col = cols[key].replace(',', ''); // deny character
      // const keyVal = col.split('='); // pembagian key value

      /**
       * increment counter success inbound_call
       * 
       * Logic untuk kalkulasi current inbound success dengan UpDownCounter
       * 
       * ketika next stream ada status===SUCCESS
       *  counter UP
       * ketika next stream ada action=verify_state
       *  counter DOWN
       * ketika detik waktu berbeda dengan sebelumnya
       *  delay 1 detik / forceFlush
       */

      // status=NO_USER_RESPONSE
      // error=400
      if (col.includes('action=inbound_call')) {
        mInboundCallSc.add(1);
        tmpSbcInboundSc.cntInboundSc++;
      } else if (col.includes('action=verify_state')) {
        mInboundCallSc.add(-1);
        tmpSbcInboundSc.cntInboundSc--;
      }
    }

    if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {
      console.log('delay');
      const timeOffSecond = (unixSecond - tmpSbcInboundSc.lastUnixSecond) * 1000; // convert to milisecond
      await timeoutPromise(() => {}, timeOffSecond);
      // await forceFlushMetricWithDelay(() => {}, meterProvider, 1000);
      tmpSbcInboundSc.lastUnixSecond = unixSecond;
    }
  }

  // reset to zero
  // mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));
  await timeoutPromise(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, 1000);
  // await forceFlushMetricWithDelay(() => {mInboundCallSc.add(Number('-' + tmpSbcInboundSc.cntInboundSc));}, meterProvider, 1000);

  lastLines[path] = lineNumber;
  lineNumber = null;
  file.close();
}
/**
 * Case: Highest SBC Inbound Call
 * Intrumentation: Asynchronous UpDownCounter
 * Selected Aggregation: Sum Aggregation
 * Aggregation Temporality: Cumulative
 * Desc: when invoked, the value will reset, i mean start from 0 again
 * Ex: when observer(5) then observer(7), the result will be 0 to 5, 5 to 0, 0 to 7, 7 to 0
 * Config:
 *  Set periodic metric exporter
 *    Interval: 1000 ms
 */
async function readWholeFileCallngLogWithAsyncUpDownCounter(path, meter) {
  const file = await fs.open(path);
  
  // const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

  const mInboundCallSc = meter.createObservableUpDownCounter('sbc_highest_inbound_success_asyncupdowncounter', {
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
        /**
         * increment counter success inbound_call
         * 
         * Logic untuk kalkulasi rate per second inbound success dengan AsyncUpDownCounter
         * 
         * ketika next stream ada status===SUCCESS
         *  cek detik, apakah di status==SUCCESS detiknya berbeda dari sebelumnya
         *  jika berbeda, maka reset data counting menjadi 0
         *  metode push dilakukan per detik, jika di detik itu ada data maka terinsert, jika tidak maka 0
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
  file.close();
}
/**
 * IN-DEVELOPMENT
 * Case: Success Rate SBC Inbound Call per Second
 * Intrumentation: Asynchronous UpDownCounter
 * Selected Aggregation: Sum Aggregation
 * Aggregation Temporality: Delta
 * Desc: when invoked, the value will reset, i mean start from 0 again
 * Ex: when observer(5) then observer(7), the result will be 0 to 5, 5 to 0, 0 to 7, 7 to 0
 * Config:
 *  Set periodic metric exporter
 *    Interval: 1000 ms
 */
async function readWholeFileCallngLogSuccessRate(path, meter) {
  const file = await fs.open(path);
  
  // const meter = meterProvider.getMeter('callng', '0.1.0', {schemaUrl: '1.1.0'});
  let lineNumber = 0;

  const mInboundCallSc = meter.createObservableUpDownCounter('sbc_inbound_success_rate_asyncupdowncounter', {
    description: 'inbound call success',
    unit: 'tps', // time per second
  });

  // used per different inbound success
  const tmpSbcInboundSc = {
    lastUnixSecond: '', // nilai terkecilnya second bukan milisecond atau dibawahnya
    cntInboundAll: 0,
    cntInboundSc: 0,
  };

  mInboundCallSc.addCallback(function(observableResult) {
    const scRatePerSecond = tmpSbcInboundSc.cntInboundSc/tmpSbcInboundSc.cntInboundAll;
    console.log('cntInboundAll', tmpSbcInboundSc.cntInboundAll, 'cntInboundSc', tmpSbcInboundSc.cntInboundSc, 'successRate', scRatePerSecond);
    tmpSbcInboundSc.cntInboundSc = 0;
    tmpSbcInboundSc.cntInboundAll = 0;
    observableResult.observe(scRatePerSecond);
  });

  for await (const line of file.readLines()) {
    ++lineNumber;
    const cols = line.split(' '); // per section
    const unixSecond = moment(cols[0]).unix();

    for (const key in cols) {
      if (cols[key].length < 1) continue; // skip yang kosong
      const col = cols[key].replace(',', ''); // deny character
      // const keyVal = col.split('='); // pembagian key value
      if (col.includes('action=inbound_call')) {
        tmpSbcInboundSc.cntInboundAll++;
      } else if (col.includes('status=SUCCESS')) {
        tmpSbcInboundSc.cntInboundSc++;
      }
    }

    // if (tmpSbcInboundSc.lastUnixSecond !== unixSecond) {
    //   const timeOffSecond = (unixSecond - tmpSbcInboundSc.lastUnixSecond) * 1000; // convert to milisecond
    //   console.log('delay', timeOffSecond / 1000);
    //   await timeoutPromise(() => {}, timeOffSecond);
    //   // await forceFlushMetricWithDelay(() => {}, meterProvider, 1000);
    //   tmpSbcInboundSc.lastUnixSecond = unixSecond;
    // }
  }

  lastLines[path] = lineNumber;
  lineNumber = null;
  file.close();
}



// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  meterProvider.shutdown()
  .then(async () => {console.log('Tracing terminated'); })
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
