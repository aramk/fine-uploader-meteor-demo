// Fine Uploader S3 for Meteor
// Derived from https://github.com/FineUploader/server-examples/blob/master/nodejs/s3/s3handler.js

const aws = require('aws-sdk');
const CryptoJS = require('crypto-js');

Object.assign(process.env, {
  SERVER_PUBLIC_KEY: Meteor.settings.s3.accessKeyId,
  SERVER_SECRET_KEY: Meteor.settings.s3.secretAccessKey,
  CLIENT_SECRET_KEY: Meteor.settings.s3.secretAccessKey
});

const BUCKET = Meteor.settings.s3.bucket;
const HOSTNAME = BUCKET + '.s3.amazonaws.com';
const SERVER_PUBLIC_KEY = Meteor.settings.s3.accessKeyId;
const SERVER_SECRET_KEY = Meteor.settings.s3.secretAccessKey;
const CLIENT_SECRET_KEY = Meteor.settings.s3.secretAccessKey;
const FILE_SIZE_MIN = null;
const FILE_SIZE_MAX = null;

if (!BUCKET || !SERVER_PUBLIC_KEY || !SERVER_SECRET_KEY || !CLIENT_SECRET_KEY) {
  throw new Error('Missing S3 configuration');
}

aws.config.update({
  accessKeyId: SERVER_PUBLIC_KEY,
  secretAccessKey: SERVER_SECRET_KEY
});
const s3 = new aws.S3();

// Meteor.methods({
//   'file-uploader/s3/signature'() {

//   },
//   'file-uploader/s3/success'() {

//   },
//   'file-uploader/s3/success.html'() {
    
//   }
// });

JsonRoutes.add('post', '/fine-uploader/s3/signature', function(req, res) {
  signRequest(req, res);
});

JsonRoutes.add('post', '/fine-uploader/s3/success', function(req, res) {
  verifyFileInS3(req, res);
});

JsonRoutes.add('get', '/fine-uploader/s3/success.html', function(req, res) {
  res.end('<html><body></body></html>');
});

JsonRoutes.add('delete', '/fine-uploader/s3/handler/:id', function(req, res) {
  deleteFile(req.query.bucket, req.query.key, function(err) {
    if (err) {
      console.error('Problem deleting file: ' + err);
      JsonRoutes.sendResult(res, {code: 500, data: err});
    } else {
      JsonRoutes.sendResult(res);
    }
  });
});

// Signs any requests.  Delegate to a more specific signer based on type of request.
function signRequest(req, res) {
  if (req.body.headers) {
    signRestRequest(req, res);
  } else {
    signPolicy(req, res);
  }
}

// Signs multipart (chunked) requests.  Omit if you don't want to support chunking.
function signRestRequest(req, res) {
  const version = req.query.v4 ? 4 : 2;
  const stringToSign = req.body.headers;
  const signature = version === 4 ? signV4RestRequest(stringToSign) : signV2RestRequest(stringToSign);

  if (isValidRestRequest(stringToSign, version)) {
    JsonRoutes.sendResult(res, {data: {signature}});
  } else {
    JsonRoutes.sendResult(res, {
      code: 400,
      data: {invalid: true}
    });
  }
}

function signV2RestRequest(headersStr) {
  return getV2SignatureKey(CLIENT_SECRET_KEY, headersStr);
}

function signV4RestRequest(headersStr) {
  const matches = /.+\n.+\n(\d+)\/(.+)\/s3\/aws4_request\n([\s\S]+)/.exec(headersStr);
  const hashedCanonicalRequest = CryptoJS.SHA256(matches[3]);
  const stringToSign = headersStr.replace(/(.+s3\/aws4_request\n)[\s\S]+/, '$1' + hashedCanonicalRequest);

  return getV4SignatureKey(CLIENT_SECRET_KEY, matches[1], matches[2], 's3', stringToSign);
}

// Signs 'simple' (non-chunked) upload requests.
function signPolicy(req, res) {
  const policy = req.body;
  const base64Policy = new Buffer(JSON.stringify(policy)).toString('base64');
  const signature = req.query.v4 ? signV4Policy(policy, base64Policy) : signV2Policy(base64Policy);

  if (isPolicyValid(req.body)) {
    JsonRoutes.sendResult(res, {
      data: {
        policy: base64Policy,
        signature: signature
      }
    });
  } else {
    JsonRoutes.sendResult(res, {
      code: 400,
      data: {invalid: true}
    });
  }
}

function signV2Policy(base64Policy) {
  return getV2SignatureKey(CLIENT_SECRET_KEY, base64Policy);
}

function signV4Policy(policy, base64Policy) {
  const conditions = policy.conditions;
  let credentialCondition;

  for (let i = 0; i < conditions.length; i++) {
    credentialCondition = conditions[i]['x-amz-credential'];
    if (credentialCondition != null) {
      break;
    }
  }

  const matches = /.+\/(.+)\/(.+)\/s3\/aws4_request/.exec(credentialCondition);
  return getV4SignatureKey(CLIENT_SECRET_KEY, matches[1], matches[2], 's3', base64Policy);
}

// Ensures the REST request is targeting the correct bucket.
// Omit if you don't want to support chunking.
function isValidRestRequest(headerStr, version) {
  if (version === 4) {
    return new RegExp('host:' + HOSTNAME).exec(headerStr) != null;
  }
  return new RegExp('\/' + BUCKET + '\/.+$').exec(headerStr) != null;
}

// Ensures the policy document associated with a 'simple' (non-chunked) request is
// targeting the correct bucket and the min/max-size is as expected.
// Comment out the FILE_SIZE_MAX and FILE_SIZE_MIN variables near
// the top of this file to disable size validation on the policy document.
function isPolicyValid(policy) {
  let bucket, parsedMaxSize, parsedMinSize, isValid;

  policy.conditions.forEach(function(condition) {
    if (condition.bucket) {
      bucket = condition.bucket;
    } else if (condition instanceof Array && condition[0] === 'content-length-range') {
      parsedMinSize = condition[1];
      parsedMaxSize = condition[2];
    }
  });

  isValid = bucket === BUCKET;

  // If FILE_SIZE_MIN and expectedMax size are not null (see above), then
  // ensure that the client and server have agreed upon the exact same
  // values.
  if (FILE_SIZE_MIN != null && FILE_SIZE_MAX != null) {
    isValid = isValid && (parsedMinSize === FILE_SIZE_MIN.toString()) && (parsedMaxSize === FILE_SIZE_MAX.toString());
  }

  return isValid;
}

// After the file is in S3, make sure it isn't too big.
// Omit if you don't have a max file size, or add more logic as required.
function verifyFileInS3(req, res) {
  function headReceived(err, data) {
    if (err) {
      console.error('S3 Error', err);
      JsonRoutes.sendResult(res, {
        code: 500,
        data: {error: 'File upload failed.'}
      });
    } else if (FILE_SIZE_MAX != null && data.ContentLength > FILE_SIZE_MAX) {
      JsonRoutes.sendResult(res, {
        code: 400,
        data: {error: 'File is too large'}
      });
      deleteFile(req.body.bucket, req.body.key, function(err) {
        if (err) {
          console.error('Could not delete invalid file!');
        }
        JsonRoutes.sendResult(res);
      });
    } else {
      JsonRoutes.sendResult(res);
    }
  }

  console.log('>>>', req.body);

  callS3('head', {
    bucket: req.body.bucket,
    key: req.body.key
  }, headReceived);
}

function getV2SignatureKey(key, stringToSign) {
  const words = CryptoJS.HmacSHA1(stringToSign, key);
  return CryptoJS.enc.Base64.stringify(words);
}

function getV4SignatureKey(key, dateStamp, regionName, serviceName, stringToSign) {
  const kDate = CryptoJS.HmacSHA256(dateStamp, 'AWS4' + key);
  const kRegion = CryptoJS.HmacSHA256(regionName, kDate);
  const kService = CryptoJS.HmacSHA256(serviceName, kRegion);
  const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);

  return CryptoJS.HmacSHA256(stringToSign, kSigning).toString();
}

function deleteFile(bucket, key, callback) {
  callS3('delete', {
    bucket: bucket,
    key: key
  }, callback);
}

function callS3(type, spec, callback) {
  s3[type + 'Object']({
    Bucket: spec.bucket,
    Key: spec.key
  }, callback)
}
