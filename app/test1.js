var Imap = require('imap');
var MongoClient = require('mongodb').MongoClient;
var inspect = require('util').inspect,
    format = require('util').format;

var config = require('./config');

var imap = new Imap(config.imap);

var q = {};
var users, mails;
var user;


MongoClient.connect(config.mongo, function (err, db) {
  if (err) throw err;

  users = db.collection('user');
  mails = db.collection('mail');

  users.findAndModify({email: e}, null, {$set: {email: e, lastUid: null}}, {upsert: true}, function (err, udoc) {
    if (err) throw err;
    user = udoc;
    init_imap();
  });

});

function init_imap(){
  imap.once('ready', function () {
    imap.openBox('INBOX', true, function (err, box) {
      if (err) throw err;
      going();
    });
  });

  imap.once('error', function (err) {
    console.log(err);
  });

  imap.once('end', function () {
    console.log('Connection ended');
  });

  imap.connect();
}


function going() {
  fetch(function (err, res) {
    if (err) throw err;
    if (res.length == 0)
      return;
    for (var i = 0; i < res.length; i++) {
      var from = res[i].body.from[0];
      var m = from.match(/(.*)\<(.*)\>/);
      if (m) {
        var n = m[1].replace('"', '').replace('"', '').trim();
        var e = m[2];
        var u = res[i].attributes.uid;
        var s = (res[i].body.subject && res[i].body.subject.length != 0) ? res[i].body.subject[0] : '';
        //console.log(res[i].seqno, u, s);
        mails.insert({
          uid: u,
          from: e,
          subject: s,
          to: res[i].body.to,
          date: res[i].body.date[0],
          attributes: res[i].attributes
        }, function (err, mdoc) {
          console.log("Y", err, mdoc);
          user.lastUid = mdoc.uid;
          users.save(user.lastUid, function (err, udoc) {
            console.log("Z", err, udoc);
            users.findAndModify({email: e}, null, {$set: {email: e}, $addToSet: {aka: n}, $inc: {messages: 1}}, {upsert: true}, function (err, udoc) {
              console.log("X", err, udoc);
            });
          });
        });
      }
    }
    console.log('-------------- ' + s + ' -------------------')
    s += w;
    going();
  });
}



function fetch(cb) {
  var f;
  if (user.lastUid)
    f = imap.fetch('SEARCH UID '+user.lastUid+':*', {
      bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
      struct: true
    });
  else
    f = imap.seq.fetch('1', {
      bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
      struct: true
    });
  var results = [];
  f.on('message', function (msg, seqno) {
    var o = {seqno: seqno, body: "", attributes: null};
    results.push(o);
    msg.on('body', function (stream, info) {
      stream.on('data', function (chunk) {
        o.body += chunk.toString('utf8');
      });
      stream.once('end', function () {
        o.body = Imap.parseHeader(o.body);
      });
    });
    msg.once('attributes', function (attrs) {
      o.attributes = attrs;
    });
    msg.once('end', function () {
    });
  });
  f.once('error', function (err) {
    cb(err);
  });
  f.once('end', function () {
    cb(null, results);
  });

}





// attachments

function getAttachments(attrs){
  var attachments = findAttachmentParts(attrs.struct);
  console.log(prefix + 'Has attachments: %d', attachments.length);
  for (var i = 0, len = attachments.length; i < len; ++i) {
    var attachment = attachments[i];
    console.log('Fetching attachment %s', attachment.params.name);
    var f = imap.fetch(attrs.uid, { //do not use imap.seq.fetch here
      bodies: [attachment.partID],
      struct: true
    });
    f.on('message', buildAttMessageFunction(attachment));

}

function findAttachmentParts(struct, attachments) {
  attachments = attachments ||  [];
  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (struct[i].disposition && ['INLINE', 'ATTACHMENT'].indexOf(struct[i].disposition.type) > -1) {
        attachments.push(struct[i]);
      }
    }
  }
  return attachments;
}

function buildAttMessageFunction(attachment) {
  var filename = attachment.params.name;
  var encoding = attachment.encoding;

  return function (msg, seqno) {
    var prefix = '(#' + seqno + ') ';
    msg.on('body', function(stream, info) {
      //Create a write stream so that we can stream the attachment to file;
      console.log(prefix + 'Streaming this attachment to file', filename, info);
      var writeStream = fs.createWriteStream(filename);
      writeStream.on('finish', function() {
        console.log(prefix + 'Done writing to file %s', filename);
      });

      //stream.pipe(writeStream); this would write base64 data to the file.
      //so we decode during streaming using
      if (encoding === 'BASE64') {
        //the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
        stream.pipe(base64.decode()).pipe(writeStream);
      } else  {
        //here we have none or some other decoding streamed directly to the file which renders it useless probably
        stream.pipe(writeStream);
      }
    });
    msg.once('end', function() {
      console.log(prefix + 'Finished attachment %s', filename);
    });
  };
}