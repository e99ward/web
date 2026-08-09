document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
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
    const mPokemon = [3, 6, 9, 15, 18, 65, 71, 80, 94, 115, 127, 130, 142, 149, 181, 208, 212,
        214, 229, 248, 254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354, 359,
        362, 373, 376, 380, 381, 382, 383, 384, 428, 445, 448, 460, 475, 531, 687, 719, 870];

    // Handle search action
    const handleSearch = async () => {
        const rawQuery = searchInput.value.trim().toLowerCase();
        if (!rawQuery) return;

        // PokeAPI uses hyphens instead of spaces for multi-word English names
        const query = rawQuery.replace(/\s+/g, '-');

        // Reset UI state
        resultCard.classList.add('hidden');
        errorMessage.classList.add('hidden');
        symbolG.classList.add('hidden');
        symbolM.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');

        try {
            // Fetch species data from PokeAPI
            let response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${query}`);

            if (!response.ok) {
                // If REST API fails (e.g., Korean name input), try searching via GraphQL
                const graphqlQuery = `query { pokemon_v2_pokemonspecies(where: {pokemon_v2_pokemonspeciesnames: {name: {_eq: "${rawQuery}"}}}) { id } }`;
                const gqlResponse = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: graphqlQuery })
                });

                const gqlData = await gqlResponse.json();

                if (gqlData.data && gqlData.data.pokemon_v2_pokemonspecies.length > 0) {
                    const foundId = gqlData.data.pokemon_v2_pokemonspecies[0].id;
                    response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${foundId}`);
                } else {
                    throw new Error('Pokemon not found');
                }
            }

            if (!response.ok) {
                throw new Error('Pokemon not found');
            }

            const data = await response.json();

            // Extract required data
            const id = data.id;

            // Find English name
            const enNameEntry = data.names.find(n => n.language.name === 'en');
            const enName = enNameEntry ? enNameEntry.name : data.name;

            // Find Japanese name (roomaji or native)
            // 'ja-Hrkt' is Kana, 'ja' is Kanji/Kana, 'roomaji' is Romaji. We'll prefer native if romaji is missing, or combined.
            const jaNameEntry = data.names.find(n => n.language.name === 'ja-Hrkt') || data.names.find(n => n.language.name === 'ja');
            const jaRoomajiEntry = data.names.find(n => n.language.name === 'roomaji');
            const jaName = jaNameEntry ? jaNameEntry.name : 'N/A';
            const jaRomaji = jaRoomajiEntry ? ` (${jaRoomajiEntry.name})` : '';

            // Find Korean name
            const koNameEntry = data.names.find(n => n.language.name === 'ko');
            const koName = koNameEntry ? koNameEntry.name : 'N/A';

            // Construct Pokemon Go Hub Image URL
            // The format is: https://db.pokemongohub.net/images/pokemon-home-renders/Normal/poke_capture_{padded_id}_000_uk_n_00000000_f_n.png
            // Note: Some Pokemon might have alternate forms (the _000_ part), we default to base form.
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

            // Set image with fallback just in case Pokemon Go Hub URL structure differs for some
            pokemonImage.onerror = () => {
                // Fallback to official artwork from PokeAPI if the Go Hub image fails to load
                pokemonImage.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
            };
            pokemonImage.src = imageUrl;

            // Show result
            loadingIndicator.classList.add('hidden');
            resultCard.classList.remove('hidden');

            // Reset animation
            resultCard.style.animation = 'none';
            resultCard.offsetHeight; // Trigger reflow
            resultCard.style.animation = null;

        } catch (error) {
            console.error('Search error:', error);
            loadingIndicator.classList.add('hidden');
            errorMessage.classList.remove('hidden');
        }
    };

    // Event listeners
    searchBtn.addEventListener('click', handleSearch);

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
});
