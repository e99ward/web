// dom elements
console.log(window.innerHeight);
document.addEventListener('DOMContentLoaded', runFirst);

let dataBase = [];
let cnt = 0;
let currentSort = 'name';

async function runFirst() {
  // load database for showing and processing
  await LoadData();
  cnt = dataBase.length;
  console.log(`Loaded ${cnt} groups from saved_db.json`);

  // Attach event listeners to filter checkboxes for dynamic updates
  ['active', 'members', 'gen1', 'gen2', 'gen3', 'gen4', 'gen5'].forEach(id => {
    let el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => applyCurrentSort());
    }
  });

  sortName();
}

async function LoadData() {
  const URL = './saved_db.json';
  try {
    const inletResponse = await fetch(URL);
    dataBase = await inletResponse.json();
    console.log(`Successfully fetched data: ${dataBase.length} items`);
  } catch (err) {
    console.error('Failed to load saved_db.json:', err);
  }
}

/* Data Helper Utilities */
function getMemberCount(group) {
  if (group.memberCount !== undefined) return group.memberCount;
  if (group.mCount !== undefined) return group.mCount;
  if (group.members && Array.isArray(group.members)) return group.members.length;
  if (group.member && Array.isArray(group.member)) return group.member.length;
  return 0;
}

function getMembers(group) {
  if (group.members && Array.isArray(group.members)) {
    return group.members.map(m => {
      if (typeof m === 'object' && m !== null) {
        return {
          name: m.name || '',
          birth: m.birth || '',
          img: m.img || ''
        };
      }
      return { name: String(m), birth: '', img: '' };
    });
  }
  if (group.member && Array.isArray(group.member)) {
    return group.member.map((name, idx) => ({
      name: name,
      birth: group.mBirth ? (group.mBirth[idx] || '') : '',
      img: group.mImg ? (group.mImg[idx] || '') : ''
    }));
  }
  return [];
}

function getDebut(group) {
  if (group.timeline && group.timeline.debut) return group.timeline.debut;
  if (group.debut) return group.debut;
  return '';
}

function getDisband(group) {
  if (group.timeline && group.timeline.disband) return group.timeline.disband;
  if (group.disband) return group.disband;
  return '';
}

function getDormant(group) {
  if (group.timeline && group.timeline.dormant) return group.timeline.dormant;
  if (group.dormant) return group.dormant;
  return '';
}

function getGen(group) {
  if (group.gen) return Number(group.gen);

  // Check explicit debut date if available
  let debut = getDebut(group);
  if (debut) {
    let m = debut.match(/(\d{4})/);
    if (m) {
      let yr = Number(m[1]);
      if (yr < 2007) return 1;
      if (yr <= 2013) return 2;
      if (yr <= 2017) return 3;
      if (yr <= 2022) return 4;
      if (yr >= 2023) return 5;
    }
  }

  // Infer from oldest member birth year
  let members = getMembers(group);
  let birthYears = [];
  for (let m of members) {
    if (m.birth) {
      let match = m.birth.match(/(\d{4})/);
      if (match) birthYears.push(Number(match[1]));
    }
  }
  if (birthYears.length > 0) {
    let minBirth = Math.min(...birthYears);
    if (minBirth <= 1985) return 1;
    if (minBirth <= 1994) return 2;
    if (minBirth <= 1998) return 3;
    if (minBirth <= 2004) return 4;
    return 5;
  }

  return 0; // Unknown generation
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Audio & Video Controls */
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
  if (!video) return;
  video.style.display = "block";
  let filename = "//www.youtube.com/embed/" + str;
  const attr = document.createAttribute("src");
  attr.value = filename;
  document.getElementById('video').setAttributeNode(attr);
}

function playVideo(str) {
  let video = document.querySelector('.youtube');
  if (video) video.style.display = "block";
  let iframe = '<iframe id="video" width="420" height="315" src="//www.youtube.com/embed/';
  iframe += str;
  iframe += '" frameborder="1" allowfullscreen></iframe>';
  iframe += '<button onclick="closeVideo()">Close</button>';
  let player = document.getElementById('player');
  if (player) player.innerHTML = iframe;
}

function closeVideo() {
  let video = document.querySelector('.youtube');
  if (video) video.style.display = "none";
  let v = document.getElementById('video');
  if (v) v.removeAttribute("src");
}

function showThem(str) {
  let brief = document.querySelector('.brief');
  if (brief) {
    document.addEventListener('mousedown', (e) => {
      brief.style.left = `${e.pageX - 10}px`;
      brief.style.top = `${e.pageY + 10}px`;
    });
  }
  let target = document.getElementById(str);
  if (target) target.style.display = "block";
}

function hideThem(str) {
  let target = document.getElementById(str);
  if (target) target.style.display = "none";
}

/* Filter State */
let isActive = false;
let isMembers = false;
let is1 = true;
let is2 = true;
let is3 = true;
let is4 = true;
let is5 = true;

function statusUpdate() {
  let x = document.getElementById("active");
  if (x) isActive = x.checked;
  let y = document.getElementById("members");
  if (y) isMembers = y.checked;
  let g1 = document.getElementById("gen1");
  if (g1) is1 = g1.checked;
  let g2 = document.getElementById("gen2");
  if (g2) is2 = g2.checked;
  let g3 = document.getElementById("gen3");
  if (g3) is3 = g3.checked;
  let g4 = document.getElementById("gen4");
  if (g4) is4 = g4.checked;
  let g5 = document.getElementById("gen5");
  if (g5) is5 = g5.checked;
}

function applyCurrentSort() {
  statusUpdate();
  let db_new = Object.values(dataBase).slice();
  if (currentSort === 'name') {
    db_new.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  } else if (currentSort === 'date') {
    db_new.sort((a, b) => (getDebut(a) || '').localeCompare(getDebut(b) || ''));
  } else if (currentSort === 'actv') {
    db_new.sort((a, b) => (getDebut(b) || '').localeCompare(getDebut(a) || ''));
  } else if (currentSort === 'nums') {
    db_new.sort((a, b) => getMemberCount(a) - getMemberCount(b));
  }

  writeDB(db_new);
}

function sortName() {
  currentSort = 'name';
  applyCurrentSort();
}

function sortDate() {
  currentSort = 'date';
  applyCurrentSort();
}

function sortActv() {
  currentSort = 'actv';
  applyCurrentSort();
}

function sortNums() {
  currentSort = 'nums';
  applyCurrentSort();
}

function shouldInclude(item) {
  let disband = getDisband(item);
  let isDisbanded = Boolean(disband && disband !== '-' && String(disband).trim() !== '');
  if (isActive && isDisbanded) {
    return false;
  }

  let g = getGen(item);
  if (g === 1 && !is1) return false;
  if (g === 2 && !is2) return false;
  if (g === 3 && !is3) return false;
  if (g === 4 && !is4) return false;
  if (g === 5 && !is5) return false;
  if (g === 0 && !is1 && !is2 && !is3 && !is4 && !is5) return false;

  return true;
}

function writeDB(db) {
  let line = lineheader;
  if (isMembers == true) {
    line = lineheader1;
  }
  for (let i = 0; i < db.length; i++) {
    let item = db[i];
    if (!shouldInclude(item)) {
      continue;
    }

    let aliasText = item.alias ? `&nbsp;&nbsp;<small>(${escapeHtml(item.alias)})</small>` : '';
    let debutText = getDebut(item) || '-';
    let disbandText = getDisband(item) || '-';
    let mCountText = getMemberCount(item);
    let agencyText = item.agency || '-';

    line += '<tr><th>';
    line += escapeHtml(item.name) + aliasText;
    line += '</th><th>';
    line += escapeHtml(debutText);
    line += '</th><th>';
    line += escapeHtml(disbandText);
    line += '</th><th>';
    line += mCountText;
    line += '</th><th>';

    if (isMembers == true) {
      let members = getMembers(item);
      for (let j = 0; j < members.length; j++) {
        let m = members[j];
        line += '<span class="image">';
        if (m.img) {
          line += `<img src="${escapeHtml(m.img)}" width="75" height="84" alt="${escapeHtml(m.name)}"><br>`;
        }
        line += escapeHtml(m.name);
        if (m.birth) {
          line += `<br><small>${escapeHtml(m.birth)}</small>`;
        }
        line += '</span>&nbsp;';
      }
      line += '</th><th>';
    }

    line += escapeHtml(agencyText);
    line += '</th></tr>';
  }

  let matrixEl = document.getElementById("matrixcontext");
  if (matrixEl) matrixEl.innerHTML = line;
}

let lineheader = '<tr class="headline"><th class="null2yr">그룹명 (Group Name)</th> \
                  <th class="null">데뷔일자</th><th class="null">해체일자</th> \
                  <th class="null">멤버수</th><th class="null2yr">소속사</th></tr>';
let lineheader1 = '<tr class="headline"><th class="null1yr">그룹명 (Group Name)</th> \
                  <th class="null">데뷔일자</th><th class="null">해체일자</th> \
                  <th class="null">멤버수</th><th class="null2yr">멤버이름&nbsp;<small>(생년월일)</small></th> \
                  <th class="null1yr">소속사</th></tr>';

function initial() {
  let matrix = document.getElementById("matrixcontext");
  let line = lineheader;
  if (matrix) matrix.innerHTML = line;
}
