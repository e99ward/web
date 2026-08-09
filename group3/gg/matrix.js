// dom elements
console.log(window.innerHeight);
document.addEventListener('DOMContentLoaded', runFirst);

let dataBase = [];
let cnt = 0;

async function runFirst() {
    // load lotto data for showing and processing
    await LoadData();
    console.log(dataBase[0]['agency']);
    console.log(dataBase[1].disband);
    console.log(dataBase[2].member[2]);
    console.log(dataBase[2].member.length);
    cnt = Object.values(dataBase).length;
    console.log(cnt);
    initial();
}

async function LoadData() {
  const URL = './saved_db_T.json';
  const inletResponse = await fetch(URL);
  dataBase = await inletResponse.json();
  console.log(dataBase)
  // inlet.forEach((item) => {
  //     groups.push(item);
  // });
  // console.log(groups)
}

/* link */
let toggle = true;
let x = document.createElement("AUDIO");

function playSong(str) {
  let filename = "./media/" + str + ".mp3";

  if (toggle == true) {
    x.setAttribute("src", filename);
    x.play();
    toggle = false;
  } else {
    x.pause();
    toggle = true;
  }
}

function playVideo_old(str) {
  let video = document.querySelector('.youtube');
  video.style.display = "block";
  let filename = "//www.youtube.com/embed/" + str;
  const attr = document.createAttribute("src");
  attr.value = filename;
  document.getElementById('video').setAttributeNode(attr);
}

function playVideo(str) {
  let video = document.querySelector('.youtube');
  video.style.display = "block";
  let iframe = '<iframe id="video" width="420" height="315" src="//www.youtube.com/embed/';
  iframe += str;
  iframe += '" frameborder="1" allowfullscreen></iframe>';
  iframe += '<button onclick="closeVideo()">Close</button>';
  document.getElementById('player').innerHTML = iframe;
}

function closeVideo () {
  let video = document.querySelector('.youtube');
  video.style.display = "none";
  document.getElementById('video').removeAttribute("src");
}

function showThem(str) {
  let brief = document.querySelector('.brief');
  document.addEventListener('mousedown', (e) => {
    brief.style.left = `${e.pageX - 10}px`;
    brief.style.top = `${e.pageY + 10}px`;
  });
  document.getElementById(str).style.display = "block";
}

function hideThem(str) {
  document.getElementById(str).style.display = "none";
}

/* database */
let db1 = [
  {name: 'Spinkl', debut: '2011-03-11', close: '', member: ['na1', 'na2', 'na3'], songs: ['so1', 'so2']},
  {name: 'IVE', debut: '2021-03-11', close: '', member: ['na1', 'na2', 'na3'], songs: ['so11', 'so12']},
  {name: 'Crue', debut: '2001-03-11', close: '2009-01-01', member: ['na1', 'na2', 'na3'], songs: ['so11', 'so12']}
];

function sortXX() {
  db1.sort(function(a, b) {
    const A = a.debut;
    const B = b.debut;
    return A < B ? -1 : A > B ? 1 : 0;
  });
  db1.sort(function(a, b) {
    const A = a.name.toUpperCase();
    const B = b.name.toUpperCase();
    return A < B ? -1 : A > B ? 1 : 0;
  });
  writeDB(db1);
}

// let dbcopy = db1.slice(0);
let isActive = false;
let isMembers = false;
let isSongs = false;
let is1 = true;
let is2 = true;
let is3 = true;
let is4 = true;

function statusUpdate() {
  let x = document.getElementById("active");
  isActive = x.checked;
  let y = document.getElementById("members");
  isMembers = y.checked;
  let z = document.getElementById("songs");
  isSongs = z.checked;
  let g1 = document.getElementById("gen1");
  is1 = g1.checked;
  let g2 = document.getElementById("gen2");
  is2 = g2.checked;
  let g3 = document.getElementById("gen3");
  is3 = g3.checked;
  let g4 = document.getElementById("gen4");
  is4 = g4.checked;
}

function sortName() {
  statusUpdate()
  if (isSongs == true) {
    writeDB2(dataBase);
  } else {
    writeDB(dataBase);
  }
}

function sortDate() {
  let db_new = Object.values(dataBase);
  db_new.sort(function(a, b) {
    const A = a.debut;
    const B = b.debut;
    return A < B ? -1 : A > B ? 1 : 0;
  });
  // console.log(db_new);
  statusUpdate()
  if (isSongs == true) {
    writeDB2(db_new);
  } else {
    writeDB(db_new);
  }
}

function sortActv() {
  let db_new = Object.values(dataBase);
  db_new.sort(function(a, b) {
    const A = a.debut;
    const B = b.debut;
    return A > B ? -1 : A < B ? 1 : 0;
  });
  // console.log(db_new);
  statusUpdate()
  if (isSongs == true) {
    writeDB2(db_new);
  } else {
    writeDB(db_new);
  }
}

function sortNums() {
  let db_new = Object.values(dataBase);
  db_new.sort(function(a, b) {
    const A = a.mCount;
    const B = b.mCount;
    return A < B ? -1 : A > B ? 1 : 0;
  });
  // console.log(db_new);
  statusUpdate()
  if (isSongs == true) {
    writeDB2(db_new);
  } else {
    writeDB(db_new);
  }
}

function writeDB(db) { // without songs
  console.log("in without songs")
  let line = lineheader;
  if (isMembers == true) {
    line = lineheader1;
  }
  for (i=0; i<cnt; i++) {
    if (isActive == true && isNaN(db[i].disband)) {
      console.log('pass the dismissed');
    } else if (is1 == false && db[i].gen == 1) {
      console.log('pass the dismissed');
    } else if (is2 == false && db[i].gen == 2) {
      console.log('pass the dismissed');
    } else if (is3 == false && db[i].gen == 3) {
      console.log('pass the dismissed');
    } else if (is4 == false && db[i].gen == 4) {
      console.log('pass the dismissed');
    } else {
      line += '<tr><th>'
      line += db[i].name;
      line += '&nbsp;&nbsp;<small>('
      line += db[i].alias;
      line += ')</small></th><th>';
      line += db[i].debut;
      line += '</th><th>';
      line += db[i].disband;
      line += '</th><th>';
      line += db[i].mCount;
      line += '</th><th>';
      if (isMembers == true) {
        for (let j=0; j < db[i].member.length; j++) {
          line += '<span class="image"><img src=';
          line += db[i].mImg[j];
          line += ' width="75" height="84"><br>';
          line += db[i].member[j];
          line += '<br><small>';
          line += db[i].mBirth[j];
          line += '</small></span>&nbsp;';
        }
        line += '</th><th>';
      }
      line += db[i].agency;
      line += '</th></tr>'
    }
  };
  document.getElementById("matrixcontext").innerHTML = line;
}

function writeDB2(db) { // with songs
  console.log("in with songs")
  let line = lineheader2;
  if (isMembers == true) {
    line = lineheader3;
  }
  for (i=0; i<cnt; i++) {
    if (isActive == true && isNaN(db[i].disband)) {
      console.log('pass the dismissed');
    } else if (is1 == false && db[i].gen == 1) {
      console.log('pass the dismissed');
    } else if (is2 == false && db[i].gen == 2) {
      console.log('pass the dismissed');
    } else if (is3 == false && db[i].gen == 3) {
      console.log('pass the dismissed');
    } else if (is4 == false && db[i].gen == 4) {
      console.log('pass the dismissed');
    } else {
      line += '<tr><th>'
      line += db[i].name;
      line += '&nbsp;&nbsp;<small>('
      line += db[i].alias;
      line += ')</small></th><th>';
      let mx = db[i].songs.length;
      if (mx > 3) { mx = 3; }
      for (let k=0; k<mx; k++) {
        line += '<span class="image">';
        line += db[i].songs[k];
        line += '<br><small>';
        line += db[i].sRelease[k];
        line += '</small></span>&nbsp;';
      }
      line += '</th><th>';
      if (isMembers == true) {
        for (let j=0; j < db[i].member.length; j++) {
          line += '<span class="image"><img src=';
          line += db[i].mImg[j];
          line += ' width="75" height="84"><br>';
          line += db[i].member[j];
          line += '<br><small>';
          line += db[i].mBirth[j];
          line += '</small></span>&nbsp;';
        }
        line += '</th><th>';
      }
      line += db[i].agency;
      line += '</th></tr>'
    }
  };
  document.getElementById("matrixcontext").innerHTML = line;
}

let lineheader = '<tr class="headline"><th class="null2yr">그룹명 (Group Name)</th> \
                  <th class="null1yr">데뷔일자</th><th class="null1yr">해체일자</th> \
                  <th class="null">멤버수</th><th class="null1yr">소속사</th></tr>';
let lineheader1 = '<tr class="headline"><th class="null1yr">그룹명 (Group Name)</th> \
                  <th class="null1yr">데뷔일자</th><th class="null1yr">해체일자</th> \
                  <th class="null">멤버수</th><th class="null2yr">멤버이름&nbsp;<small>(생년월일)</small></th> \
                  <th class="null1yr">소속사</th></tr>';
let lineheader2 = '<tr class="headline"><th class="null1yr">그룹명 (Group Name)</th> \
                  <th class="null3yr">대표곡&nbsp;<small>(발표일)</small></th><th class="null1yr">소속사</th></tr>';
let lineheader3 = '<tr class="headline"><th class="null1yr">그룹명 (Group Name)</th> \
                  <th class="null3yr">대표곡&nbsp;<small>(발표일)</small></th> \
                  <th class="null2yr">멤버이름&nbsp;<small>(생년월일)</small></th><th class="null1yr">소속사</th></tr>';


function initial() {
  let matrix = document.getElementById("matrixcontext");
  let line = lineheader;
  matrix.innerHTML = line;
}
