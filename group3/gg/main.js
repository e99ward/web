// dom elements
//let scrl = document.querySelector('section');
//let numSec = document.querySelectorAll('section');
let mvLeft = document.querySelector('.container .left');
let mvRight = document.querySelector('.container .right');
let mvUp = document.querySelector('.container .top');
let mvDown = document.querySelector('.container .bottom');

//const scrlMx = scrl.clientHeight * (numSec.length - 1);
//console.log(scrl.clientHeight);
console.log(window.innerHeight);
//console.log(scrlMx);
mvLeft.addEventListener('click', moveLeft);
mvRight.addEventListener('click', moveRight);
mvUp.addEventListener('click', moveUp);
mvDown.addEventListener('click', moveDown);

// functions
function moveUp() {
  window.scrollBy(0, -10);
  console.log(window.scrollY);
}

function moveDown() {
  window.scrollBy(0, 10);
  console.log(window.scrollY);
}

function moveRight() {
  window.scrollBy(50, 0);
  console.log(window.scrollY);
}

function moveLeft() {
  window.scrollBy(-50, 0);
  console.log(window.scrollY);
}

/* link */
/* deleted */