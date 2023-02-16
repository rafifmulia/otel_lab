'use strict';

const path = require('path');
const fs = require('node:fs/promises');

// Options
const options = { port: 9995, startServer: true };

const opentelemetry = require('@opentelemetry/api');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const {
  BasicTracerProvider,
  ConsoleSpanExporter,
  BatchSpanProcessor,
  SimpleSpanProcessor,
} = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { MeterProvider } = require('@opentelemetry/sdk-metrics');

opentelemetry.diag.setLogger(new opentelemetry.DiagConsoleLogger(), opentelemetry.DiagLogLevel.DEBUG);

registerInstrumentations({
  instrumentations: [],
});

const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'node-getlog',
    [SemanticResourceAttributes.SERVICE_VERSION]: '0.1.0',
  })
);

const tracerProvider = new NodeTracerProvider({ resource });
const tracer = tracerProvider.getTracer('tracer-getlog');
opentelemetry.trace.setGlobalTracerProvider(tracerProvider);

const exporter = new JaegerExporter({
  serviceName: resource.attributes[SemanticResourceAttributes.SERVICE_NAME],
  endpoint: 'http://localhost:14268/api/traces',
});

const prometheusExporter = new PrometheusExporter(options);

const meterProvider = new MeterProvider({
  exporter: prometheusExporter,
  interval: 1000,
});

const meter = meterProvider.getMeter('example-prometheus');

// Recording metrics data
const counter = meter.createCounter('metric_name', {
  description: 'Example of a counter',
});
counter.add(10, { pid: process.pid });

(async () => {
  const pathLog = path.resolve('..', 'callng.log.2');

  const parentSpan = tracer.startSpan('callng.log.2');

  const file = await fs.open(pathLog);
  let cntr = 1;
  for await (const line of file.readLines()) {
    const cols = line.split(' ');
    const childSpan = tracer.startSpan(`line ${cntr}`, { parent: parentSpan });
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
      childSpan.setAttribute(prop, val);
      log[prop] = val;
    }for (const key in cols) {
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
      childSpan.setAttribute(prop, val);
      log[prop] = val;
    }

    childSpan.addEvent('log-getlog', log);
    childSpan.end();
    counter.add(1, { pid: process.pid });
    cntr++;
  }

  parentSpan.end();
})();

process.on('SIGTERM', () => {
    sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
  });