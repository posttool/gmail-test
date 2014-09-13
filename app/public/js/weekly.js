var $el = $("#c");

var year = 2014, week = 0, x = 10; //current year, week, x position
var H = 150; // if we fix height
var W = 30; // fixed width of week

$el.append("<h2>"+year+"</h2>");
var $t = $("<div></div>").addClass("tooltip");
$el.append($t);
var $c = $("<div></div>").addClass("messages");
$el.append($c);
var $weeks = $("<div></div>").addClass("weeks");
$el.append($weeks);

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
    $bb.css({position:'absolute',left: x+'px'});
    $weeks.append($bb);

    x += W;
    get_data();
  });
}

get_data();

var selectedEmail = null;
var $selected = null;
var $selectedw = null;
var C = {}; // data about people

function overEmail(e, o) {
  if (!C[e] || !C[e].rects)
    return;
  for (var i = 0; i < C[e].rects.length; i++)
    C[e].rects[i].css({opacity: o})
}

function getWeek(data, t) {
  var $r = $("<div></div>");
  var y = H - t*2;
  for (var i = 0; i < data.length; i++) {
    (function (week, dr, i) {
      var e = dr.sender;
      var h = H * (dr.hits / t);
      if (!C[e])
        C[e] = {
          rects: []
        };
      var $b = $("<div></div>");
      C[e].rects.push($b);
      var cc = 'rgb(' + 50 + ', ' + 150 + ', ' + Math.floor(255 - 255 * (i /data.length)) + ')';
      $b.css({'background-color': cc, opacity: .2, height: h + 'px', width: W + 'px'});
      $b.mouseover(function (d) {
        $t.show();
        $t.text(dr.sender + " " + dr.hits);
        var pp = $b.parent().position();
        $t.css({'top': 32+'px', 'left': (pp.left)+'px'});
        overEmail(dr.sender,.75);
     }).mouseout(function (d) {
        if ($selected) {
          $t.text(selectedEmail);
          var pp = $selected.parent().position();
          $t.css({'top': 32+'px', 'left': (pp.left)+'px'});
        } else $t.text("");
        overEmail(dr.sender, selectedEmail == dr.sender ? 1 :.2);
      }).click(function () {
        if ($selectedw)
          $selectedw.removeClass('selected');
        if ($selected)
          $selected.removeClass('selected');
        overEmail(selectedEmail, .2);
        $selectedw = $($weeks.children()[week-1]);
        $selectedw.addClass('selected');
        selectedEmail = dr.sender;
        $selected = $b;
        $selected.addClass('selected');
        overEmail(selectedEmail, 1);
        getMessages(dr);
      });
      y += h;
      $r.append($b);
    })(week, data[i], i);
  }
  $r.append("<div class='small'>"+week+"</div>");
  return $r;
}


//
function getMessages(dr) {
  var s = {};
  $c.empty();
//  var $g = $("<img src='http://gravatar.com/avatar/"+md5(dr.sender.toLowerCase().trim())+"'/>");
//  $c.append($g);
  var $t = $("<table></table>");
  $c.append($t);
  $.ajax('/2/' + dr._id).done(function (r) {
    for (var i = 0; i < r.length; i++) {
      if (!s[r[i].subject]) {
        s[r[i].subject] = true;
        var d = new Date(r[i].date);
        var ds = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec'][d.getMonth()] + " " + d.getDate()
        var $tr = $("<tr></tr>");
        var $td1 = $("<td></td>")
        var $td2 = $("<td></td>")
        $td1.append("<span class='medium'>" + ds + "</span>");
        $td2.append(r[i].subject);
        $tr.append($td1, $td2);
        $t.append($tr);
      }
    }
  });
}