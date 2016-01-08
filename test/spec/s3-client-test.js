const S3Client = require('../../lib/s3-client');
const assert = require('assert');
const sinon = require('sinon');
const childProcess = require('child_process');
const _ = require('lodash');

describe('S3Client', function() {
	const execOrig = childProcess.exec;

	afterEach(function() {
		childProcess.exec = execOrig;
	});


	describe('sync', function() {

		it('should run aws s3 sync', function(done) {
			childProcess.exec = sinon.spy((cmd, opts, cb) => {
				assert.strictEqual(cmd, 'aws s3 sync s3://my-bucket/foo/bar /local/foo/bar');
				assert.deepStrictEqual(opts.env, {
					AWS_ACCESS_KEY_ID: 'testId',
					AWS_SECRET_ACCESS_KEY: 'testKey',
					AWS_DEFAULT_REGION: 'testRegion'
				});

				const stdout = `
download: s3://my-bucket/foo/bar/a.file to bar/a.file
Completed 1032 of 1043 part(s) with 11 file(s) remaining
download: s3://my-bucket/foo/bar/b.file to bar/b.file
Completed 1033 of 1043 part(s) with 10 file(s) remaining
Completed 1034 of 1043 part(s) with 10 file(s) remaining
download: s3://my-bucket/foo/bar/nested/c.file to bar/nested/c.file`;

				cb(null, new Buffer(stdout, 'utf8'), new Buffer(0));
			});

			const s3Client = S3Client({
				accessKeyId: 'testId',
				secretAccessKey: 'testKey',
				region: 'testRegion'
			});

			s3Client.sync('s3://my-bucket/foo/bar', '/local/foo/bar')
				.then(res => {
					assert(childProcess.exec.called, 'called exec()');

					const cwd = process.cwd();
					assert(_.include(res.files, `${cwd}/bar/a.file`), 'includes a.file');
					assert(_.include(res.files, `${cwd}/bar/b.file`), 'includes b.file');
					assert(_.include(res.files, `${cwd}/bar/nested/c.file`), 'includes c.file');

					done();
				}).catch(done);
		});

		it('should use a delete flag', function(done) {
			childProcess.exec = sinon.spy((cmd, opts, cb) => {
				try {
					assert.strictEqual(cmd, 'aws s3 sync s3://my-bucket/foo/bar /local/foo/bar --delete');
				} catch (err) { return done(err); }

				cb(null, new Buffer(0), new Buffer(0));
			});

			const s3Client = S3Client({
				accessKeyId: 'testId',
				secretAccessKey: 'testKey',
				region: 'testRegion'
			});

			s3Client.sync('s3://my-bucket/foo/bar', '/local/foo/bar', { delete: true })
				.then(res => {
					assert(childProcess.exec.called, 'called exec()');
					done();
				}).catch(done);
		});

		describe('locking', function() {

			it('should fail if sync is already in progress', function(done) {
				childProcess.exec = sinon.spy();

				const s3Client = S3Client({
					accessKeyId: 'testId',
					secretAccessKey: 'testKey',
					region: 'testRegion'
				});

				s3Client.sync('s3://my-bucket/foo', '/foo');

				s3Client.sync('s3://my-bucket/foo', '/foo')
					.catch(err => {
						assert.strictEqual(err.code, 'SYNC_IN_PROGRESS', 'error code');
						done();
					})
					.catch(done);
			});

			it('should not lock syncing to different target directories', function(done) {
				childProcess.exec = sinon.spy((cmd, opts, cb) => {
					setTimeout(() => cb(null, new Buffer(0), new Buffer(0)), 10);
					return { pid: 1234567 };
				});

				const s3Client = S3Client({
					accessKeyId: 'testId',
					secretAccessKey: 'testKey',
					region: 'testRegion'
				});

				Promise.all([
					// Sync to /foo
					s3Client.sync('s3://my-bucket/foo', '/foo'),
					// Sync to /bar
					s3Client.sync('s3://my-bucket/foo', '/bar')
				])
					.then(() => done())
					.catch(done);
			});

			it('should sync if previous sync is complete', function(done) {
				// Stub exec() to resolve immediately
				childProcess.exec = sinon.spy((cmd, opts, cb) => cb(null, new Buffer(0), new Buffer(0)));

				const s3Client = S3Client({
					accessKeyId: 'testId',
					secretAccessKey: 'testKey',
					region: 'testRegion'
				});

				s3Client.sync('s3://my-bucket/foo', '/foo')
					.then(() => s3Client.sync('s3://my-bucket/foo', '/foo'))
					.then(() => done(), done);
			});

		});


	});

});