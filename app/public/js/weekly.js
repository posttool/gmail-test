var $el = $("#c");

var year = 2013, week = 0, x = 10; //current year, week, x position
var H = 150; // if we fix height
var W = 30; // fixed width of week

$el.append("<h2>"+year+"</h2>");
var $t = $("<div></div>").addClass("tooltip");
$el.append($t);
var $c = $("<div></div>").addClass("messages");
$el.append($c);

function get_data() {
  week++;
  if (week > 52) {
    return;
    year++;
    week = 1;
  }
  $.ajax('/1/' + year + '/' + week).done(function (r) {
    var t = 0;
    for (var i = 0; i < r.length; i++)
      t += r[i].hits;
    var $bb = getWeek(r, t);
    $bb.css({position:'absolute',left: x+'px'})
    $el.append($bb);

    x += W;
    get_data();
  });
}

get_data();

var selected = null;
var C = {}; // data about people

function overWeek(e, o) {
  if (!C[e] || !C[e].rects)
    return;
  for (var i = 0; i < C[e].rects.length; i++)
    C[e].rects[i].css({opacity: o})
}
function getWeek(data, t) {
  var $r = $("<div></div>");
  var y = H - t*2;
  for (var i = 0; i < data.length; i++) {
    (function (dr, i) {
      var e = dr.sender;
      var h = H * (dr.hits / t);
      if (!C[e])
        C[e] = {
//          color: {
//            r: Math.floor(35 * Math.random()),
//            g: Math.floor(155 * Math.random()),
//            b: Math.floor(255 * Math.random())
//          },
          rects: []
        };
      var $b = $("<div></div>");
      C[e].rects.push($b);
      var cc = 'rgb(' + 50 + ', ' + 150 + ', ' + Math.floor(255 - 255 * (i /data.length)) + ')';
      $b.css({'background-color': cc, opacity: .2, height: h + 'px', width: W + 'px'});

      $b.mouseover(function (d) {
        overWeek(dr.sender, 1);
        $t.show();
        $t.text(dr.sender + " " + dr.hits);
        var pp = $b.parent().position();
        $t.css({'top': 32+'px', 'left': (pp.left)+'px'});
      }).mouseout(function (d) {
        $t.hide();
        if (selected == dr.sender)
          return;
        overWeek(dr.sender, .2);
      }).click(function () {
        overWeek(selected, .2);
        selected = dr.sender;
        overWeek(selected, 1);
        getMessages(dr);
      });
      y += h;
      $r.append($b);
    })(data[i], i);
  }
  $r.append("<div class='small'>"+week+"</div>");
  return $r;
}


//
function getMessages(dr) {
  var s = {};
  $c.empty();
  $.ajax('/2/' + dr._id).done(function (r) {
    for (var i = 0; i < r.length; i++) {
      if (!s[r[i].subject]) {
        s[r[i].subject] = true;
        $c.append(r[i].date + " " + r[i].subject + "<br>");
      }
    }
  });
}