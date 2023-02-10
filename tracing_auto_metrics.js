'use strict';

const opentelemetry = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { OTLPTraceExporter} = require("@opentelemetry/exporter-trace-otlp-http");
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { BasicTracerProvider, ConsoleSpanExporter, BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);


/**
 * pake service namanya
 */
// // This registers all instrumentation packages
// registerInstrumentations({
//   instrumentations: [
//     getNodeAutoInstrumentations()
//   ],
// });

// const resource =
//   Resource.default().merge(
//     new Resource({
//       [SemanticResourceAttributes.SERVICE_NAME]: "service-A",
//       [SemanticResourceAttributes.SERVICE_VERSION]: "0.1.0",
//     })
//   );

// const provider = new NodeTracerProvider({
//   resource: resource,
// });
// const exporter = new ConsoleSpanExporter();
// // const exporter = new BasicTracerProvider();
// const processor = new BatchSpanProcessor(exporter);
// provider.addSpanProcessor(processor);

// provider.register();


/**
 * bisa ngirim trace dan metrics
 */
const sdk = new opentelemetry.NodeSDK({
  // CARA 1 dimunculkan di console
  // traceExporter: new opentelemetry.tracing.ConsoleSpanExporter(),
  // CARA 2 langsung dikirim
  traceExporter: new OTLPTraceExporter({
    // optional - default url is http://localhost:4318/v1/traces
    url: "http://localhost:4318/v1/traces",
    // optional - collection of custom headers to be sent with each request, empty by default
    headers: {},
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
