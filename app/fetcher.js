var Imap = require('imap');

var forEach = require('./utils').forEach;
var config = require('./config');


var _db, users, mails, relationships;


function Fetcher(imapConfig){
  this.imapConfig = imapConfig;
  this.user = null;
  this.imap = null;
  this.box = null;
}
module.exports = Fetcher;


//Fetcher.prototype.initConnection = function(cb) {
//  MongoClient.connect(config.mongo, function (err, db) {
//    self.initDb(db, cb);
//  });
//};


Fetcher.prototype.initDb = function (db, cb) {
  // static?
  _db = db;
  users = db.collection('user');
  mails = db.collection('mail');
  relationships = db.collection('relationship');
  //
  var self = this;
  if (self.imapConfig.user) {
    self.initUser(self.imapConfig.user, function () {
      self.initImap(function () {
        cb();
      });
    });
  }

};


Fetcher.prototype.clean = function(cb) {
    users.remove({}, function () {
    mails.remove({}, function () {
      cb();
    })});
};


Fetcher.prototype.initUser = function(e, cb){
  var self = this;
  users.findAndModify({email: e}, null, {$set: {email: e, lastUids: {}}}, {upsert: true, 'new': true}, function (err, udoc) {
    if (err) throw err;
    self.user = udoc;
    console.log("user",err,udoc);
    cb();
  });
};


Fetcher.prototype.set_last_uid = function(uid, cb) {
  var self = this;
  self.user.lastUids[self.box] = uid;
  users.save(self.user, function(err, s){
    if (err) return cb(err);
    cb(null, s);
  })
};


Fetcher.prototype.get_last_uid = function() {
  return this.user.lastUids[self.box];
};


Fetcher.prototype.initImap = function(cb){
  var imap = new Imap(this.imapConfig);
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
  this.imap = imap;
};


//Fetcher.prototype.getInbox = function (cb) {
//  this.getBox('INBOX', cb);
//}


//Fetcher.prototype.getOutbox = function (cb) {
//  this.getBox('[Gmail]/Sent Mail', cb);
//}


Fetcher.prototype.getBox = function (boxType, cb) {
  var self = this;
  self.box = boxType;
  self.imap.openBox(boxType, true, function (err, box) {
    if (err) throw err;
    console.log("opened", box);
    self.fetch_some(function () {
      self.imap.closeBox(function (err) {
        cb();
      });
    });
  });
};


Fetcher.prototype.fetch_some = function (complete) {
  var self = this;
  self.fetch(function (err, res) {
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
      // no! no! no! next 2 lines ... get more info... or have more context
      if (tos.indexOf(self.user.email) == -1)
        tos.push(self.user.email);
      //
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
        self.set_last_uid(mdoc[0].uid);
        //self.user.lastUid = mdoc[0].uid;
        users.save(self.user, function (err, udoc) {
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
      console.log('-------------- ' + self.box+ " " +self.get_last_uid() + ' -------------------')
      self.fetch_some(complete);
    });
  });
}


// imap fetching

Fetcher.prototype.fetch = function (cb) {
  var self = this;
  var f;
  var fopts = {
    bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE Message-ID References In-Reply-To)',
    struct: true
  };
  var luid = self.get_last_uid();
  console.log("FETCH from " + luid);
  if (luid)
    self.imap.search([
      ['UID', (luid + 1) + ':' + (luid + 1000)]
    ], function (err, results) {
      //console.log('search res', err, results)
      if (!results || results.length == 0)
        return cb(null, null);
      f = self.imap.fetch(results, fopts);
      handle_events(f);
    });
  else {
    f = self.imap.seq.fetch('1', fopts);
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
      console.log("ERR",err);
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