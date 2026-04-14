const EventEmitter = require('events');

// Global event emitter for the autoheal platform
class PipelineEventEmitter extends EventEmitter {}
const pipelineEvents = new PipelineEventEmitter();

module.exports = pipelineEvents;
