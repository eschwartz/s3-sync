const execp = require('./exec-promise');
const _ = require('lodash');
const path = require('path');

/**
 * @param s3Opts
 * @param {string} s3Opts.accessKeyId
 * @param {string} s3Opts.secretAccessKey
 * @param {string} s3Opts.region
 */
function S3Client(s3Opts) {
	const awsEnv = {
		AWS_ACCESS_KEY_ID: s3Opts.accessKeyId,
		AWS_SECRET_ACCESS_KEY: s3Opts.secretAccessKey,
		AWS_DEFAULT_REGION: s3Opts.region
	};

	var activeSyncDirs = [];

	function lockSync(targetDir) {
		if (_.contains(activeSyncDirs, targetDir)) {
			const err = new Error(`Unable to sync: sync already in progress to dir ${targetDir}`);
			err.code = 'SYNC_IN_PROGRESS';
			return Promise.reject(err);
		}

		activeSyncDirs.push(targetDir);

		return Promise.resolve();
	}

	function unlockSync(targetDir) {
		activeSyncDirs = _.without(activeSyncDirs, targetDir);
		return Promise.resolve();
	}

	return {
		/**
		 *
		 * @param {string} from
		 * @param {string} to
		 *
		 * @param {Object} opts
		 * @param {boolean} opts.delete
		 *                  Files that exist in the destination but not in the source
		 *                  are deleted during sync.
		 * @param {stream.Writable} opts.stdout If defined, child process stdout will be piped to it
		 * @param {stream.Writable} opts.stderr If defined, child process stderr will be piped to it
		 *
		 * @returns {Promise<{ stdout: string, stderr: stderr, files: string[] }>}
		 */
		sync: (from, to, opts) =>
			lockSync(to)
				.then(() => execp(
					`aws s3 sync ${from} ${to}` + (_.get(opts, 'delete') ? ' --delete' : ''),
					{
						env: awsEnv,
						stdout: _.get(opts, 'stdout'),
						stderr: _.get(opts, 'stderr')
					}
				))
				.then(res => unlockSync(to).then(() => res))
				.then(res => ({
					stdout: res.stdout,
					stderr: res.stderr,
					files: parseSyncFilesFromStdout(res.stdout)
				}))
	};

	/**
	 * Get a list of downloaded files from `aws s3 sync` output.
	 *
	 * This is a pretty hacky solution. However, our alternatives are not so much better:
	 *
	 * - Use `node-s3-client` library, which fails to match etags to md5s on large files,
	 * 		causing it to re-downloaded large files every time.
	 * - Roll our own `s3 sync` implementation, which would probably run into the same issues,
	 *   (because we cannot rely on how the AWS API generates its etags).
	 *
	 * @param stdout
	 * @returns {*}
	 */
	function parseSyncFilesFromStdout(stdout) {
		return stdout.toString('utf8')
			// Split into lines
			.split(new RegExp('\n|\r'))

			// Match 'download to' path
			.map(str => new RegExp('^download: .+ to (.+)$').exec(str))
			.filter(matches => !!matches)
			.map(matches => matches[1])

			// paths are relative to cwd.
			.map(filePath => path.join(process.cwd(), filePath));
	}
}

module.exports = S3Client;

