const EventEmitter = require('events');

// Global event emitter for the autoheal platform
class PipelineEventEmitter extends EventEmitter {}
const pipelineEvents = new PipelineEventEmitter();
pipelineEvents.setMaxListeners(50); // Increase limit for SSE connections

module.exports = pipelineEvents;
