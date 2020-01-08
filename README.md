# couchfirehose

A proof-of-concept tool that allows Cloudant/CouchDB data to be transferred between a source database and a target database. This **is not** replication:

- It doesn't transfer every revision of every document. Only the winners.
- It doesn't transfer attachments.
- It optionally doesn't transfer deleted documents.
- It optionally doesn't transfer design documents documents.
- It can optionally transform the document in transit.

## How does it work?

The source database's _changes feed_ is consumed in batches and a queue of bulk writes is built
up in the app. The queue is worked through at a the specified concurrency with the data being written
to the target database in batches.

## Installation

```sh
npm install -g couchfirehose
```

## Configuration

Both producer and consumer are configured using command-line parameters:

- `--source`/`-s` - the URL of the source Cloudant database, including authentication.
- `--target`/`-t` - the URL of the target Cloudant database, including authentication.
- `--batchsize`/`-b` - the number of documents per write request. (Default 500)
- `--concurrency`/`-c` - the number of writes in flight. (Default 2)
- `--maxwrites`/`-m` - the maximum number of write requests to issue per second. (Default 5)
- `--filterdesigndocs`/`--fdd` - whether to omit design documents from the data transfer. (Default false)
- `--filterdeletions`/`--fd` - whether to omit deleted documents from the data transfer. (Default false)
- `--resetrev`/`-r` - omits the revision token, resetting the targets revisions to `1-xxx'. (Default false)
- `--transform` - the path of synchronous JavaScript transformation function. (Default null)

 or environment variables:

- `SOURCE_URL` - the URL of the source Cloudant database, including authentication.
- `TARGET_URL` - the URL of the target Cloudant database, including authentication.
- `BATCH_SIZE` - the number of documents per write request. (Default 500)
- `CONCURRENCY` - the number of writes in flight. (Default 2)
- `MAX_WRITES_PER_SECOND` - the maximum number of write requests to issue per second. (Default 5)
- `FILTER_DESIGN_DOCS` - whether to omit design documents from the data transfer. (Default false)
- `FILTER_DELETIONS` - whether to omit deleted documents from the data transfer. (Default false)
- `RESET_REV` - omits the revision token, resetting the targets revisions to `1-xxx'. (Default false)
- `TRANSFORM` - the path of synchronous JavaScript transformation function. (Default null)

## Usage

Command-line paramters:

```sh
> couchfirehose -s 'https://u:p@host.cloudant.com/source' -t 'https://u:p@host.cloudant.com/target'
```

Environment variables:

```sh
> export SOURCE_URL="https://u:p@host.cloudant.com/source"
> export TARGET_URL="https://u:p@host.cloudant.com/target"
> couchfirehose
```

## Transfering a subset of documents

- to ignore deleted documents, pass `--filterdeletions true` on the command line.
- to ignore design documents, pass `--filterdesigndocs true` on the command line.

e.g.

```sh
> couchfirehose -s "$URL/source" -t "$URL/target" --filterdeletions true --filterdesigndocs true
```

## Example transform function

To transfer the form of the documents in flight, supply the path of a file that contains an exported
filter function.

- it should be a synchronous JavaScript function.
- it should take one parameter - the document.
- it should return the modified document.
- if you the document is not to be written to the target, return `null`

```js
const f = (doc) => {

  // add new fields
  doc.ts = new Date().getTime()

  // remove unwanted fields
  delete doc.status

  // fix data
  doc.type = doc.type.toLowerCase()

  // use the transform function to filter out documents that are not required
  if (doc.price < 0) {
    doc = null
  }
  return doc
}
module.exports = f
```

Pass the path to the function file as the `--transform parameter`:

```sh
> couchfirehose -s "$URL/source" -t "$URL/target" --transform ./transformer.js
```
