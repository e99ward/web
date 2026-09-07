/* ── Category switching ── */
const catButtons   = document.querySelectorAll('.category-btn');
const galleryItems = document.querySelectorAll('#carousel .item');

function filterByCategory(cat) {
  galleryItems.forEach(it => {
    it.style.display = it.dataset.category === cat ? 'flex' : 'none';
  });
}

catButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    catButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterByCategory(btn.dataset.category);
  });
});

// Show only Category A on load
filterByCategory('A');

/* ── Carousel navigation ── */
const carousel = document.getElementById('carousel');
document.getElementById('carouselLeft').addEventListener('click', () => {
  carousel.scrollBy({ left: -300, behavior: 'smooth' });
});
document.getElementById('carouselRight').addEventListener('click', () => {
  carousel.scrollBy({ left: 300, behavior: 'smooth' });
});

/* ── Description modal ── */
const modal      = document.getElementById('descModal');
const modalImg   = document.getElementById('modalImg');
const modalTitle = document.getElementById('modalTitle');
const modalDesc  = document.getElementById('modalDesc');
const copyBtn    = document.getElementById('copyBtn');
const modalClose = document.getElementById('modalClose');

galleryItems.forEach(item => {
  item.addEventListener('click', () => {
    const img = item.querySelector('img');
    modalImg.src           = img.src;
    modalImg.alt           = img.alt;
    modalTitle.textContent = item.dataset.title || img.alt;
    modalDesc.textContent  = item.dataset.desc  || 'No description available.';
    copyBtn.textContent    = '📋 Copy Description';
    copyBtn.classList.remove('copied');
    modal.classList.add('active');
  });
});

// Close on backdrop click (but not card click)
modal.addEventListener('click', e => {
  if (e.target === modal) modal.classList.remove('active');
});
modalClose.addEventListener('click', () => modal.classList.remove('active'));

// Copy description to clipboard
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(modalDesc.textContent);
    copyBtn.textContent = '✅ Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy Description';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (err) {
    console.error('Clipboard write failed:', err);
  }
});
