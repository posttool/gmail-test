var Imap = require('imap');
var MongoClient = require('mongodb').MongoClient;
var inspect = require('util').inspect,
    format = require('util').format;

var forEach = require('./utils').forEach;
var config = require('./config');

var imap = new Imap(config.imap);

var q = {};
var users, mails, relationships;
var user;

var cmd = process.argv[2];
if (cmd == 'clean')
  clean(function(){ process.exit(1); });
else if (cmd == 'mailboxes')
  getMailBoxes(function(){ process.exit(1); });
else if (cmd == 'import')
  importAll(function(){ process.exit(1); });
else if (cmd == 'relationships')
  getRelationships(function(){ process.exit(1); });


function clean(cb) {
  initConnection(function () {
    deleteAll(function () {
      initUser(function () {
        console.log('ready');
        cb();
      });
    });
  });
}


function getMailBoxes(cb) {
  initConnection(function () {
    initUser(function () {
      initImap(function () {
        imap.getBoxes(function (err, b) {
          for (var p in b) {
            console.log(p);
            var c = b[p].children;
            for (var pc in c) {
              console.log("  "+pc);
            }
          }
          cb();
        });
      });
    });
  });
}

function importAll(cb) {
  initConnection(function () {
    initUser(function () {
      initImap(function () {
        imap.getBoxes(function (err, b) {
          for (var p in b) {
            console.log(p);
            user.lastUids[p] = 0;
            fetch(function(){
              var c = b[p].children;
              for (var pc in c) {
                console.log("  "+pc);
              }
            });
          }
        });
      });
    });
  });
}

function getRelationships(cb){
    initConnection(function () {
    initUser(function () {
      initImap(function () {
        computeRelationships(function(){
          console.log("DONE!");
        });
      });
    });
  });
}


function initConnection(cb) {
  MongoClient.connect(config.mongo, function (err, db) {
    if (err) throw err;

    console.log("connected");
    users = db.collection('user');
    mails = db.collection('mail');
    relationships = db.collection('relationship');

    cb();
  });
}

function deleteAll(cb) {
  users.remove({}, function () {
    mails.remove({}, function () {
      relationships.remove({}, function () {
        cb();
      });
    });
  });
}

function initUser(cb){
  var e = config.imap.user;
  users.findAndModify({email: e}, null, {$set: {email: e, lastUids: {}}}, {upsert: true, 'new': true}, function (err, udoc) {
    if (err) throw err;
    user = udoc;
    console.log("user",err,udoc);
    cb();
  });
}

function initImap(cb){
  imap.once('ready', function () {
    cb();
  });
  imap.once('error', function (err) {
    console.log(err);
  });
  imap.once('end', function () {
    console.log('Connection ended');
  });
  imap.connect();
}

function getInbox(cb) {
  getBox('INBOX', cb);
}

function getOutbox(cb) {
  getBox('[Gmail]/Sent Mail', cb);
}

function getBox(boxType, cb) {
  imap.openBox(boxType, true, function (err, box) {
    if (err) throw err;
    console.log("opened", box);
    fetch_some(function () {
      imap.closeBox(function (err) {
        cb();
      });
    });
  });
}

function fetch_some(complete) {
  fetch(function (err, res) {
    if (err) throw err;
    if (!res || res.length == 0)
    {
      console.log("COMPLETE");
      complete();
      return;
    }
    console.log("processing", res.length);
    forEach(res, function (r, next) {
      //console.log("*");
      var from = r.body.from[0];
      var m = parse_email(from);
      if (!m)
        return next();
      var u = r.attributes.uid;
      var s = (r.body.subject && r.body.subject.length != 0) ? r.body.subject[0] : '';
      var tos = parse_emails_only(r.body.to);
      if (tos.indexOf(user.email) == -1)
        tos.push(user.email);
      var mid = r.body['message-id'][0];
      var irt = r.body['in-reply-to'] ? r.body['in-reply-to'][0] : null;
      var rf = r.body['references'] ? r.body['references'][0].split(' ') : null;
      var d = r.body.date && r.body.date.length != 0 ? new Date(r.body.date[0]) : null;
      //insert mail
      mails.insert({ // might want to upsert
        uid: u,
        messageId: mid,
        inReplyTo: irt,
        references: rf,
        from: m.email,
        subject: s,
        to: tos,
        date: d,
        attributes: r.attributes
      }, function (err, mdoc) {
        if (err) throw err;
        console.log("saved mail", s);
        // update my stats (last mail indexed)
        user.lastUid = mdoc[0].uid;
        users.save(user, function (err, udoc) {
          if (err) throw err;
          // console.log("saved last seen uid ", mdoc[0].uid);
          // add or update the person its from
          users.findAndModify({email: m.email}, null, {$set: {email: m.email}, $addToSet: {aka: m.name}}, {upsert: true, 'new': true}, function (err, u2doc) {
            if (err) throw err;
            next();
          });
        });
      });
    }, function(){
      console.log('-------------- ' + user.lastUid + ' -------------------')
      fetch_some(complete);
    });
  });
}

// computing relationships between people
function computeRelationships(complete) {
  mails.find({}, function (err, resultCursor) {
    function processItem(err, item) {
      if (item === null)
        return complete();
      forEach(item.to, function (t, n) {
        var w = getWeekNumber(item.date);
        relationships.findAndModify(
          {sender: item.from, receiver: t, year: w[0], week: w[1]}, null,
          {$set: {sender: item.from, receiver: t, year: w[0], week: w[1]}, $inc: {hits: 1}, $addToSet: {mail: item._id}},
          {upsert: true, 'new': true}, function (err, rdoc) {
            if (err) throw err;
            //console.log("relationship", rdoc)
            n();
          });
      }, function (err) {
        resultCursor.nextObject(processItem);
      });
    }
    resultCursor.nextObject(processItem);
  });
}



// imap fetching

function fetch(cb) {
  var f;
  var fopts = {
    bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE Message-ID References In-Reply-To)',
    struct: true
  };
  console.log("FETCH from " + user.lastUid);
  if (user.lastUid)
    imap.search([
      ['UID', (user.lastUid + 1) + ':' + (user.lastUid + 1000)]
    ], function (err, results) {
      //console.log('search res', err, results)
      if (!results || results.length == 0)
        return cb(null, null);
      f = imap.fetch(results, fopts);
      handle_events(f);
    });
  else {
    f = imap.seq.fetch('1', fopts);
    handle_events(f);
  }

  function handle_events(f) {
    var results = [];
    f.on('message', function (msg, seqno) {
      //console.log("seqno:", seqno)
      var o = {seqno: seqno, body: "", attributes: null};
      results.push(o);
      msg.on('body', function (stream, info) {
        stream.on('data', function (chunk) {
          o.body += chunk.toString('utf8');
        });
        stream.once('end', function () {
          o.body = Imap.parseHeader(o.body);
          //console.log(o.body)
        });
      });
      msg.once('attributes', function (attrs) {
        o.attributes = attrs;
      });
      msg.once('end', function () {
      });
    });
    f.once('error', function (err) {
      console.log("ERR",err)
      cb(err);
    });
    f.once('end', function () {
      cb(null, results);
    });
  }

}




// email parsing
function parse_email(s) {
  if (!s)
    return null;
  var m = s.match(/(.*)\<(.*)\>/);
  if (m) {
    var n = m[1].replace('"', '').replace('"', '').trim();
    var e = m[2];
    return {name: n, email: e};
  }
  return null;
}
function parse_emails(a){
  if (!a)
    return []
  var pa = [];
  for (var i=0; i< a.length; i++)
  {
    var p = parse_email(a[i]);
    if (p)
      pa.push(p);
  }
  return pa;
}
function parse_emails_only(a){
  var pa = parse_emails(a);
  var ea = [];
  for (var i=0; i< pa.length; i++)
    ea.push(pa[i].email)
  return ea;
}





// get week number from date
function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(+d);
    d.setHours(0,0,0);
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    // Get first day of year
    var yearStart = new Date(d.getFullYear(),0,1);
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7)
    // Return array of year and week number
    return [d.getFullYear(), weekNo];
}










// attachments  // TODO

function getAttachments(attrs) {
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