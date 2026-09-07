document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    const resultCard = document.getElementById('resultCard');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');

    const pokemonImage = document.getElementById('pokemonImage');
    const pokemonId = document.getElementById('pokemonId');
    const symbolG = document.getElementById('symbolG');
    const symbolM = document.getElementById('symbolM');
    const nameEn = document.getElementById('nameEn');
    const nameJa = document.getElementById('nameJa');
    const nameKo = document.getElementById('nameKo');

    const gPokemon = [3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143, 569, 809,
        812, 815, 818, 823, 826, 834, 839, 841, 842, 844, 849, 851, 858, 861, 869, 879, 892];
    const mPokemon = [3, 6, 9, 15, 18, 26, 36, 65, 71, 80, 94, 115, 121, 127, 130, 142, 149,
        150, 154, 160, 181, 208, 212, 214, 227, 229, 248, 254, 257, 260, 282, 302, 303, 306,
        308, 310, 319, 323, 334, 354, 358, 359, 362, 373, 376, 380, 381, 382, 383, 384, 398,
        428, 445, 448, 460, 475, 478, 485, 491, 500, 530, 531, 545, 560, 604, 609, 623, 652,
        655, 658, 668, 670, 678, 687, 689, 691, 701, 718, 719, 740, 768, 780, 801, 807, 870,
        952, 970, 978, 998];

    let pokemonIndex = [];
    let selectedSuggestionIndex = -1;
    let currentResults = [];
    let debounceTimer = null;

    // Fetch and cache complete multi-language Pokémon index
    const initPokemonIndex = async () => {
        try {
            const cached = localStorage.getItem('pokemon_search_index_v2');
            if (cached) {
                pokemonIndex = JSON.parse(cached);
                return;
            }

            const graphqlQuery = `query {
                pokemon_v2_pokemonspecies(order_by: {id: asc}, limit: 1025) {
                    id
                    name
                    pokemon_v2_pokemonspeciesnames(where: {language_id: {_in: [1, 2, 3, 9, 11]}}) {
                        name
                        language_id
                    }
                }
            }`;

            const res = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: graphqlQuery })
            });

            if (!res.ok) return;

            const data = await res.json();
            if (data.data && data.data.pokemon_v2_pokemonspecies) {
                pokemonIndex = data.data.pokemon_v2_pokemonspecies.map(sp => {
                    const names = sp.pokemon_v2_pokemonspeciesnames || [];
                    const enObj = names.find(n => n.language_id === 9);
                    const koObj = names.find(n => n.language_id === 3);
                    const jaObj = names.find(n => n.language_id === 1 || n.language_id === 11);
                    const romajiObj = names.find(n => n.language_id === 2);

                    return {
                        id: sp.id,
                        slug: sp.name,
                        en: enObj ? enObj.name : sp.name,
                        ko: koObj ? koObj.name : '',
                        ja: jaObj ? jaObj.name : '',
                        romaji: romajiObj ? romajiObj.name : ''
                    };
                });

                localStorage.setItem('pokemon_search_index_v2', JSON.stringify(pokemonIndex));
            }
        } catch (err) {
            console.warn('Could not load Pokémon search index:', err);
        }
    };

    initPokemonIndex();

    // Levenshtein distance for fuzzy matching typos
    const levenshteinDistance = (a, b) => {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;

        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        return matrix[b.length][a.length];
    };

    // Calculate score for a single target name against query
    const getScoreForName = (targetStr, q) => {
        if (!targetStr) return 0;
        const target = targetStr.toLowerCase();
        if (target === q) return 1000;
        if (target.startsWith(q)) return 500 - (target.length - q.length);
        const subIdx = target.indexOf(q);
        if (subIdx !== -1) return 300 - subIdx;

        if (q.length >= 3) {
            const dist = levenshteinDistance(q, target);
            const maxDist = Math.max(1, Math.floor(q.length / 3));
            if (dist <= maxDist) {
                return 100 - dist * 20;
            }
        }
        return 0;
    };

    // Fuzzy search engine
    const searchPokemonIndex = (rawQuery) => {
        const cleanQ = rawQuery.trim().toLowerCase();
        if (!cleanQ || pokemonIndex.length === 0) return [];

        const scored = [];
        const cleanNoHash = cleanQ.replace(/^#/, '');
        const isNumeric = /^\d+$/.test(cleanNoHash);
        const numVal = isNumeric ? parseInt(cleanNoHash, 10) : null;

        for (const sp of pokemonIndex) {
            let maxScore = 0;

            if (numVal !== null && sp.id === numVal) {
                maxScore = 2000;
            } else if (isNumeric && String(sp.id).startsWith(cleanNoHash)) {
                maxScore = 800;
            } else {
                const candidates = [sp.slug, sp.en, sp.ko, sp.ja, sp.romaji];
                for (const cand of candidates) {
                    const score = getScoreForName(cand, cleanQ);
                    if (score > maxScore) maxScore = score;
                }
            }

            if (maxScore > 0) {
                scored.push({ pokemon: sp, score: maxScore });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 8).map(s => s.pokemon);
    };

    // Render autocomplete dropdown suggestions
    const renderDropdown = (results) => {
        currentResults = results;
        selectedSuggestionIndex = -1;

        if (results.length === 0) {
            const rawVal = searchInput.value.trim();
            if (rawVal) {
                autocompleteDropdown.innerHTML = `<div class="no-match-item">No Pokémon found matching "${rawVal}"</div>`;
                autocompleteDropdown.classList.remove('hidden');
            } else {
                autocompleteDropdown.classList.add('hidden');
            }
            return;
        }

        autocompleteDropdown.innerHTML = results.map((sp, idx) => {
            const paddedId = `#${String(sp.id).padStart(3, '0')}`;
            const secondary = [sp.ko, sp.ja].filter(Boolean).join(' • ');
            const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sp.id}.png`;

            return `
                <div class="autocomplete-item" data-index="${idx}" data-id="${sp.id}">
                    <img src="${spriteUrl}" alt="${sp.en}" onerror="this.style.opacity=0.3" />
                    <div class="autocomplete-info">
                        <span class="autocomplete-name-primary">${sp.en}</span>
                        <span class="autocomplete-name-secondary">${secondary || sp.slug}</span>
                    </div>
                    <span class="autocomplete-id">${paddedId}</span>
                </div>
            `;
        }).join('');

        autocompleteDropdown.classList.remove('hidden');

        // Add click events to items
        autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-index'), 10);
                if (currentResults[idx]) {
                    selectPokemon(currentResults[idx]);
                }
            });
        });
    };

    // Highlight item in dropdown for keyboard navigation
    const updateActiveSuggestion = () => {
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        items.forEach((item, idx) => {
            if (idx === selectedSuggestionIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    };

    // Fetch and display specific Pokémon details by ID or species object
    const selectPokemon = async (pokemonObjOrId) => {
        autocompleteDropdown.classList.add('hidden');
        let targetId = typeof pokemonObjOrId === 'object' ? pokemonObjOrId.id : pokemonObjOrId;

        // Set input value to English name if object available
        if (typeof pokemonObjOrId === 'object' && pokemonObjOrId.en) {
            searchInput.value = pokemonObjOrId.en;
        }

        // Reset UI state
        resultCard.classList.add('hidden');
        errorMessage.classList.add('hidden');
        symbolG.classList.add('hidden');
        symbolM.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');

        try {
            let response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${targetId}`);

            if (!response.ok) {
                throw new Error('Pokemon species not found');
            }

            const data = await response.json();
            const id = data.id;

            // Find English name
            const enNameEntry = data.names.find(n => n.language.name === 'en');
            const enName = enNameEntry ? enNameEntry.name : data.name;

            // Find Japanese name (roomaji or native)
            const jaNameEntry = data.names.find(n => n.language.name === 'ja-Hrkt') || data.names.find(n => n.language.name === 'ja');
            const jaRoomajiEntry = data.names.find(n => n.language.name === 'roomaji');
            const jaName = jaNameEntry ? jaNameEntry.name : 'N/A';
            const jaRomaji = jaRoomajiEntry ? ` (${jaRoomajiEntry.name})` : '';

            // Find Korean name
            const koNameEntry = data.names.find(n => n.language.name === 'ko');
            const koName = koNameEntry ? koNameEntry.name : 'N/A';

            // Construct image URL
            const paddedId = String(id).padStart(4, '0');
            const imageUrl = `https://db.pokemongohub.net/images/pokemon-home-renders/Normal/poke_capture_${paddedId}_000_uk_n_00000000_f_n.png`;

            // Update UI
            pokemonId.textContent = `#${String(id).padStart(3, '0')}`;
            nameEn.textContent = enName;
            nameJa.textContent = `${jaName}${jaRomaji}`;
            nameKo.textContent = koName;

            // Update symbols
            if (gPokemon.includes(id)) symbolG.classList.remove('hidden');
            if (mPokemon.includes(id)) symbolM.classList.remove('hidden');

            // Image load with fallback
            pokemonImage.onerror = () => {
                pokemonImage.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
            };
            pokemonImage.src = imageUrl;

            // Show result
            loadingIndicator.classList.add('hidden');
            resultCard.classList.remove('hidden');

            resultCard.style.animation = 'none';
            resultCard.offsetHeight; // Trigger reflow
            resultCard.style.animation = null;

        } catch (error) {
            console.error('Fetch error:', error);
            loadingIndicator.classList.add('hidden');
            errorMessage.classList.remove('hidden');
        }
    };

    // Main search handler triggered by button click or Enter key
    const handleSearch = async () => {
        const rawQuery = searchInput.value.trim();
        if (!rawQuery) return;

        autocompleteDropdown.classList.add('hidden');

        // Check if there is an active selection in keyboard nav
        if (selectedSuggestionIndex >= 0 && currentResults[selectedSuggestionIndex]) {
            selectPokemon(currentResults[selectedSuggestionIndex]);
            return;
        }

        // Search in local index with fuzzy engine
        const fuzzyMatches = searchPokemonIndex(rawQuery);
        if (fuzzyMatches.length > 0) {
            selectPokemon(fuzzyMatches[0]);
            return;
        }

        // Direct fallback query if index doesn't have it yet
        selectPokemon(rawQuery.toLowerCase().replace(/\s+/g, '-'));
    };

    // Input listener for live autocomplete suggestions
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput.value.trim();
            if (!query) {
                autocompleteDropdown.classList.add('hidden');
                currentResults = [];
                return;
            }
            const results = searchPokemonIndex(query);
            renderDropdown(results);
        }, 120);
    });

    // Keyboard navigation handlers
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentResults.length > 0) {
                selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentResults.length;
                updateActiveSuggestion();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentResults.length > 0) {
                selectedSuggestionIndex = (selectedSuggestionIndex - 1 + currentResults.length) % currentResults.length;
                updateActiveSuggestion();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        } else if (e.key === 'Escape') {
            autocompleteDropdown.classList.add('hidden');
        }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
            autocompleteDropdown.classList.add('hidden');
        }
    });

    // Focus on input when clicking search button
    searchBtn.addEventListener('click', handleSearch);
});
