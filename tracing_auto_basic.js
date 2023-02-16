'use strict';

const opentelemetry = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter} = require("@opentelemetry/exporter-trace-otlp-http");
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sdk = new opentelemetry.NodeSDK({
  // CARA 1 dimunculkan di console
  // traceExporter: new opentelemetry.tracing.ConsoleSpanExporter(),
  // CARA 2 langsung dikirim
  traceExporter: new OTLPTraceExporter({
    // optional - default url is http://localhost:4318/v1/traces
    url: "http://localhost:4318/v1/traces",
    // optional - collection of custom headers to be sent with each request, empty by default
    headers: {},
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'node_app'
    })
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start()
  .then(() => console.log('Tracing initialized'))
  .catch((error) => console.log('Error initializing tracing', error));

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
  .then(() => console.log('Tracing terminated'))
  .catch((error) => console.log('Error terminating tracing', error))
  .finally(() => process.exit(0));
  });
