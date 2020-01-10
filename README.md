# couchfirehose

A proof-of-concept tool that allows Cloudant/CouchDB data to be transferred quickly between a source database and a target database. This **is not** replication:

- It doesn't transfer every revision of every document. Only the winners.
- It doesn't transfer attachments.
- It optionally doesn't transfer deleted documents.
- It optionally doesn't transfer design documents documents.
- It can optionally transform the document in transit.

It is faster than replication but gets its speed by assuming that the source database is static and the the target database is empty. 

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
- `--selector` - a selector query used to filter the source's documents. (Default null)

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
- `SELECTOR` - a selector query used to filter the source's documents. (Default null)

## Usage

Command-line parameters:

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
- to filter by a custom _selector_, pass your selector using `--selector` on the command line.

e.g.

```sh
> # ignore deletions and design docs
> couchfirehose -s "$URL/source" -t "$URL/target" --filterdeletions true --filterdesigndocs true
> # only include documents that pass the supplied filter
> couchfirehose -s "$URL/source" -t "$URL/target" --selector '{"country": "ZA"}'
```

## Transforming data during transfer

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

## Discussion

The _couchfirehose_ utility can transfer data from source to target faster than replication, but it isn't doing the same job as only winning revisions are transferred and attachments are dropped. Proceed with caution if your source database is changing when running _couchfirehose_ or if your target database is not empty.

If your use-case can cope with the source database being static and the target database being empty, then you can transfer data much faster than replication and take advantage of the easy filtering and transformation options that _couchfirehose_ offers.

## Debugging

To see extra debug messages, run _couchfirehose_ with the environment variable `DEBUG` set to `couchfirehose` e.g.

```sh
```sh
> DEBUG=couchfirehose couchfirehose -s "$URL/source" -t "$URL/target"
```