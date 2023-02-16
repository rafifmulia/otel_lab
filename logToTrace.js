'use strict';

const path = require('path');
const fs = require('node:fs/promises');

// const opentelemetry = require("@opentelemetry/sdk-node");
const opentelemetry = require('@opentelemetry/api');
// const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { BasicTracerProvider, ConsoleSpanExporter, BatchSpanProcessor, SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

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

// const provider = new NodeTracerProvider({
//   resource: resource,
// });
const provider = new BasicTracerProvider({
  resource: resource,
});




/**
 * Set the right exporter and processor
 */

// example => console exporter and batch processor
// const exporter = new ConsoleSpanExporter();
// const processor = new BatchSpanProcessor(exporter);
// provider.addSpanProcessor(processor);

// jaeger exporter and simpleSpan processor
// const exporter = new JaegerExporter({
//   endpoint: 'http://localhost:14268/api/traces',
// });
// provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

// jaeger exporter and batchSpan processor
// const exporter = new JaegerExporter({
//   endpoint: 'http://localhost:14268/api/traces',
// });
// provider.addSpanProcessor(new BatchSpanProcessor(exporter));
// provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));

// otel exporter and batchSpan processor
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
})
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

provider.register();




/**
 * This is using jaeger exporter and simpleSpan processor + ConsoleSpanExporter
 */
(async() => {
  const pathLog = path.resolve('..', 'callng.log.2');
  // const logText = fs.readFileSync(pathLog, {encoding: 'utf-8'});
  // for (let data in logText) {
  //   console.log(data);
  // }

  const tracer = opentelemetry.trace.getTracer('tracer-getlog');
  const parentSpan = tracer.startSpan('callng.log.2');
  const parentCtx = opentelemetry.trace.setSpan(opentelemetry.context.active(), parentSpan);

  const file = await fs.open(pathLog);
  let cntr = 1;
  for await (const line of file.readLines()) {
    const cols = line.split(' ');
    const childSpan = tracer.startSpan('line ' + cntr, undefined, parentCtx);
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
    }

    childSpan.addEvent('log-getlog', log);
    childSpan.end();
    cntr++;
  }

  parentSpan.end();
  exporter.shutdown();

})();




// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
  .then(() => console.log('Tracing terminated'))
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
});
