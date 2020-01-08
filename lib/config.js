
const assert = require('assert')
const config = {
  SOURCE_URL: process.env.SOURCE_URL,
  TARGET_URL: process.env.TARGET_URL,
  FILTER_DESIGN_DOCS: process.env.FILTER_DESIGN_DOCS === 'true',
  FILTER_DELETIONS: process.env.FILTER_DELETIONS === 'true',
  RESET_REV: process.env.RESET_REV === 'true',
  BATCH_SIZE: process.env.BATCH_SIZE || '500',
  CONCURRENCY: process.env.CONCURRENCY || '2',
  MAX_WRITES_PER_SECOND: process.env.MAX_WRITES_PER_SECOND || '50',
  TRANSFORM: process.env.TRANSFORM || null
}

const args = require('yargs')
  .option('source', { alias: 's', type: 'string', describe: 'Source CouchDB database URL', default: config.SOURCE_URL })
  .option('target', { alias: 't', type: 'string', describe: 'Target CouchDB database URL', default: config.TARGET_URL })
  .option('filterdeletions', { alias: 'fd', type: 'boolean', describe: 'Filter out deleted documents', default: config.FILTER_DELETIONS })
  .option('filterdesigndocs', { alias: 'fdd', type: 'boolean', describe: 'Filter out design documents', default: config.FILTER_DESIGN_DOCS })
  .option('resetrev', { alias: 'r', type: 'boolean', describe: 'Reset the revision token', default: config.RESET_REV })
  .option('batchsize', { alias: 'b', type: 'number', describe: 'Number of documents written in one bulk write', default: config.BATCH_SIZE })
  .option('concurrency', { alias: 'c', type: 'number', describe: 'Number of write HTTP calls in flight at one time', default: config.CONCURRENCY })
  .option('maxwrites', { alias: 'm', type: 'number', describe: 'Maximum number of writes per second', default: config.MAX_WRITES_PER_SECOND })
  .option('transform', { type: 'string', describe: 'Path for transform JS function', default: config.TRANSFORM })
  .help('help')
  .argv

// copy back to config
const mapping = {
  source: 'SOURCE_URL',
  target: 'TARGET_URL',
  filterdeletions: 'FILTER_DELETIONS',
  filterdesigndocs: 'FILTER_DESIGN_DOCS',
  resetrev: 'RESET_REV',
  batchsize: 'BATCH_SIZE',
  concurrency: 'CONCURRENCY',
  maxwrites: 'MAX_WRITES_PER_SECOND',
  transform: 'TRANSFORM'
}
for (var i in mapping) {
  if (args[i]) {
    config[mapping[i]] = args[i]
  }
}

// check validity of the SOURCE_URL
const url = require('url')
const u = new url.URL(config.SOURCE_URL)
if (u.pathname === '/') {
  throw new Error('SOURCE_URL is missing a database name')
}

// check validity of the TARGET_URL
const u2 = new url.URL(config.TARGET_URL)
if (u2.pathname === '/') {
  throw new Error('TARGET_URL is missing a database name')
}

// split out database name from the source url
config.SOURCE_DATABASE_NAME = u.pathname.replace(/^\//, '')
u.pathname = '/'
config.SOURCE_URL = u.toString().replace(/\/$/, '')
config.TARGET_DATABASE_NAME = u2.pathname.replace(/^\//, '')
u2.pathname = '/'
config.TARGET_URL = u2.toString().replace(/\/$/, '')

// check BATCH_SIZE is sensible
try {
  if (typeof config.BATCH_SIZE === 'string') {
    config.BATCH_SIZE = parseInt(config.BATCH_SIZE)
  }
  assert.ok(config.BATCH_SIZE > 0)
} catch (e) {
  throw new Error('BATCH_SIZE must be a number >= 1')
}

// check CONCURRENCY is sensible
try {
  if (typeof config.CONCURRENCY === 'string') {
    config.CONCURRENCY = parseInt(config.CONCURRENCY)
  }
  assert.ok(config.CONCURRENCY > 0)
} catch (e) {
  throw new Error('CONCURRENCY must a number >= 1')
}

// check MAX_WRITES_PER_SECOND is sensible
try {
  if (typeof config.MAX_WRITES_PER_SECOND === 'string') {
    config.MAX_WRITES_PER_SECOND = parseInt(config.MAX_WRITES_PER_SECOND)
  }
  assert.ok(config.MAX_WRITES_PER_SECOND > 0)
} catch (e) {
  throw new Error('MAX_WRITES_PER_SECOND must a number >= 1')
}

// load the transform function
if (config.TRANSFORM) {
  const path = require('path')
  config.TRANSFORM = require(path.resolve(process.cwd(), config.TRANSFORM))
}

module.exports = config
