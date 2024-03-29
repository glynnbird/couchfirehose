const config = require('./lib/config.js')
const debug = require('debug')('couchfirehose')

// cloudant connection for target writes
const axios = require('axios')

// changes reader instance configured for our source database
const ChangesReader = require('changesreader')
const changesReader = new ChangesReader(config.SOURCE_DATABASE_NAME, config.SOURCE_URL)
const CHANGES_BATCH_SIZE = config.BATCH_SIZE * 20

// rate-limited, fixed-concurrency queue
const qrate = require('qrate')
let counter = 0

// buffer of unsaved documents
const buffer = []

// milliseconds
const ms = () => {
  return new Date().getTime()
}

// output status
const status = () => {
  // output status
  const now = Math.floor((ms() - start) / 1000)
  process.stdout.write(`  ${now}s ${counter}/${numDocs}      \r`)
}

// worker function that writes a batch of documents to Cloudant
const worker = async (batch) => {
  debug(`writing ${batch.docs.length} docs`)
  let containsRevs = false
  for (const i in batch.docs) {
    if (batch.docs[i]._rev) {
      containsRevs = true
      break
    }
  }
  if (containsRevs) {
    batch.new_edits = false
  }
  try {
    const req = {
      method: 'post',
      baseURL: config.TARGET_URL,
      url: config.TARGET_DATABASE_NAME + '/_bulk_docs',
      data: batch
    }
    await axios.request(req)
    counter += batch.docs.length
    status()
  } catch (e) {
    console.error(e)
  }
}

// queue of batch jobs limited to "concurrency" requests
// in flight at any one time and a maximum number of
// writes per second limited to "wps"
const q = qrate(worker, config.CONCURRENCY, config.MAX_WRITES_PER_SECOND)
let numDocs = 0
let changesFeedEnded = false
const start = ms()

const main = async () => {
  const opts = {
    wait: true,
    fastChanges: true,
    since: '0',
    includeDocs: true,
    batchSize: CHANGES_BATCH_SIZE
  }
  if (config.SELECTOR) {
    opts.selector = config.SELECTOR
  } else if (config.FILTER_DELETIONS) {
    opts.selector = {
      _deleted: {
        $exists: false
      }
    }
  }
  changesReader.get(opts)
    .on('batch', (batch, callback) => {
      // loop through each doc in the batch
      for (const i in batch) {
        // find the doc
        let doc = batch[i].doc

        // optionally remove _rev
        if (config.RESET_REV) {
          delete doc._rev
        }

        // optionally ignore deletions
        if (config.FILTER_DELETIONS && batch[i].deleted === true) {
          continue
        }

        // optionally ignore design docs
        if (config.FILTER_DESIGN_DOCS && doc._id.startsWith('_design')) {
          continue
        }

        // optionally transform the document
        if (config.TRANSFORM) {
          doc = config.TRANSFORM(doc)
        }

        // add to the buffer and add to the batch queue
        if (doc) {
          buffer.push(doc)
          if (buffer.length > config.BATCH_SIZE) {
            const docsToWrite = buffer.splice(0, config.BATCH_SIZE)
            q.push({ docs: docsToWrite })
          }
          numDocs++
        }
      }
      status()

      // only call the callback if the queue needs refreshing
      // if we always callback straight away then we end up buffering too
      // much data.
      const interval = setInterval(() => {
        const ql = q.length()
        if (ql < config.CONCURRENCY * 10) {
          callback()
          clearInterval(interval)
        }
      }, 100)
    })
    .on('end', async () => {
      changesFeedEnded = true
      flush()
    })
}

// queue is empty
q.drain = () => {
  const end = ms()
  if (changesFeedEnded) {
    console.log(`Written ${counter} documents to the target database in ${(end - start) / 1000}s`)
    process.exit()
  }
}

// catch the dregs of the buffer
const flush = () => {
  while (buffer.length > 0) {
    const n = Math.min(buffer.length, config.BATCH_SIZE)
    const docsToWrite = buffer.splice(0, n)
    q.push({ docs: docsToWrite })
  }
}

main()
