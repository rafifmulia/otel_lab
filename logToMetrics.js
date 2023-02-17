'use strict';

const path = require('path');
const fs = require('node:fs/promises');

// const opentelemetry = require("@opentelemetry/sdk-node");
const opentelemetry = require('@opentelemetry/api');
// const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter }  = require('@opentelemetry/sdk-metrics');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
opentelemetry.diag.setLogger(new opentelemetry.DiagConsoleLogger(), opentelemetry.DiagLogLevel.DEBUG);

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
// const exporter = new PrometheusExporter({
//   // host: '0.0.0.0',
//   startServer: true,
//   port: 9466,
// });
meterProvider.addMetricReader(new PeriodicExportingMetricReader({
  exporter: exporter,
  exportIntervalMillis: 1000,
}));
// meterProvider.addMetricReader(exporter);




/**
 * This is using jaeger exporter and simpleSpan processor + ConsoleSpanExporter
 */
(async() => {
  const pathLog = path.resolve('..', 'callng.log.2');
  // const logText = fs.readFileSync(pathLog, {encoding: 'utf-8'});
  // for (let data in logText) {
  //   console.log(data);
  // }

  const file = await fs.open(pathLog);
  let cntr = 1;
  for await (const line of file.readLines()) {
    const cols = line.split(' ');
    const log = {};

    for (const key in cols) {
      let col = cols[key].replace(',', '');
      let propVal = col.split('=');
      let prop, val = '';
      if (key === 0) {
        prop = 'date';
        val = propVal[0];
      } else if (key === 1) {
        prop = 'host';
        val = propVal[0];
      } else {
        prop = propVal[0];
        val = propVal[1];
      }
      // SemanticResourceAttributes.
      log[prop] = val;
    }
    cntr++;
  }
});




/**
 * Example metrics
 */
const meter = meterProvider.getMeter('example-exporter-collector');

const requestCounter = meter.createCounter('requests', {
  description: 'Example of a Counter',
});

const upDownCounter = meter.createUpDownCounter('test_up_down_counter', {
  description: 'Example of a UpDownCounter',
});

const histogram = meter.createHistogram('test_histogram', {
  description: 'Example of a Histogram',
});

const counter = meter.createCounter('tercounter');

const attributes = { pid: process.pid };

let itr = setInterval(() => {
  requestCounter.add(1, attributes);
  upDownCounter.add(Math.random() > 0.5 ? 1 : -1, attributes);
  histogram.record(Math.random(), attributes);
  counter.add(10, { 'key1': 'value1' });
}, 1000);
setTimeout(() => {
  clearInterval(itr);
}, 5010);




// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
  .then(() => console.log('Tracing terminated'))
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
