'use strict';

const path = require('path');
const fs = require('node:fs/promises');
const chokidar = require('chokidar');

const opentelemetry = require('@opentelemetry/api');
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter }  = require('@opentelemetry/sdk-metrics');

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
    url: 'http://otel-col:4318/v1/metrics',
  });
  meterProvider.addMetricReader(new PeriodicExportingMetricReader({
    exporter: exporter,
    exportIntervalMillis: 5000,
  }));

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
  
    const split = path.split('/');
    const filename = split[split.length-1];
    if (filename === 'callng.log.2') {
      readWholeFileCallngLog(path);
    }
  }
  function fileChanged(path) {
    console.log('File', path, 'has been changed');
    initCheckLastLine(path);
  
    const split = path.split('/');
    const filename = split[split.length-1];
    if (filename === 'callng.log.2') {
      readUpdatedFileCallngLog(path);
    }
  }
  function fileRemoved(path) {
    console.log('File', path, 'has been removed');
    initCheckLastLine(path);
  
    const split = path.split('/');
    const filename = split[split.length-1];
    if (filename === 'callng.log.2') {
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


  //Baca seluruh data log
  async function readWholeFileCallngLog(path) {
    const before = process.memoryUsage().heapUsed / 1024 / 1024;
    const file = await fs.open(path);
    // const logs = [];
  
    const meter = meterProvider.getMeter('callng.log.2');
    const inboundCallCounter = meter.createCounter('inbound_call', {
      description: 'Counter of Inbound Call',
    });
  
    let lineNumber = 0;
    for await (const line of file.readLines()) {
      ++lineNumber;
      const cols = line.split(' ');
      // const log = {};
  
      for (const key in cols) {
        let col = cols[key].replace(',', '');  
            if (col.includes('inbound_call')) {
            console.log('ADD: inboundCallCounter.add(1);');
            inboundCallCounter.add(1);
        }
      }
    }
    lastLines[path] = lineNumber;
    const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
    console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  }

  //Baca file yang sudah di update
  async function readUpdatedFileCallngLog(path) {
    const before = process.memoryUsage().heapUsed / 1024 / 1024;
    const file = await fs.open(path);
    // const logs = [];
  
    const meter = meterProvider.getMeter('callng.log.2');
    const inboundCallCounter = meter.createCounter('inbound_call', {
      description: 'Counter of Inbound Call',
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
        } else {
          prop = propVal[0];
          val = propVal[1];
        }
        if (prop.length < 1) continue;
        // log[prop] = val;
  
        if (col.includes('inbound_call')) {
          console.log(col.includes('inbound_call'));
          console.log('UPDATE: inboundCallCounter.add(1);');
          inboundCallCounter.add(1);
        }
        
      }
    
    }
    if (lastLines[path] < lineNumber) lastLines[path] = lineNumber;
    console.log('end lastLines', lastLines);
    // console.log(logs);
    const used = (process.memoryUsage().heapUsed / 1024 / 1024) - before;
    console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  }
  
  //remove
  async function RemovedFileCallngLog(path) {
    lastLines[path] = 0;
  }

  process.on('SIGTERM', () => {
    sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
  });
  