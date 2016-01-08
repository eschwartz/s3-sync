s3-sync
=========
Node.js wrapper around [the AWS CLI S3 sync command](http://docs.aws.amazon.com/cli/latest/reference/s3/sync.html)

**Why would I use this instead of [node-s3-client](https://github.com/andrewrk/node-s3-client)?**

In order to compare files, node-s3-client attempts to reimplement the hashing algorithm used by the AWS API in creating an s3 object's etag. My experience is that is doesn't always work (especially with large files). 

This library uses the AWS CLI tool, which -- though it also re-implements the hashing algorithm -- it at least supported by the same team which created the algorithm. 

s3-sync also:
* Locks download paths, meaning it will not allow you to download an object from s3 to the same local file path.
* Resolves with a list of downloaded files paths

## Usage

```js
const s3Client = S3Client({
  accessKeyId: 'testId',
  secretAccessKey: 'testKey',
  region: 'testRegion'
});

s3Client.sync('s3://my-bucket/foo/bar', '/local/foo/bar', {
  // set to `true` to enable the --delete flag
  delete: false,
  // Accepts a stream.Writable, to which the `s3 sync` stdout will be piped
  stdout: process.stdout
  // Accepts a stream.Writable, to which the `s3 sync` stderr will be piped
  stdout: process.stdout
})
  .then(res => {
    // res.stdout is the stdout from the `s3 sync` command
    // res.stderr is the stderr from the `s3 sync` command
    // res.files is an array of downloaded file paths
  })
```

`s3Client.sync` also accepts error-first callbacks, for example:

```js
s3Client.sync(from, to, opts, (err, res) => {
    // res.stdout is the stdout from the `s3 sync` command
    // res.stderr is the stderr from the `s3 sync` command
    // res.files is an array of downloaded file paths
});
```