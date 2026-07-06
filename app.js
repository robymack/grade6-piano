// --- DATA GENERATION (Syllabus Taxonomy) ---
const dyns = ['f', 'mf', 'p'];
const arts = ['legato', 'staccato'];

let combinations = [];

function addCombo(category, root, type, bpm, octaves, hands, isLegatoOnly = false) {
    dyns.forEach(d => {
        let validArts = isLegatoOnly ? ['legato'] : arts;
        validArts.forEach(a => {
            combinations.push({
                id: `${category}_${root}_${type}_${d}_${a}`.replace(/\s+/g, ''),
                category, root, type, dynamic: d, articulation: a, bpm, octaves, hands
            });
        });
    });
}

// 1. Scales (Bb, D Major & Minor variants)
['Bb', 'D'].forEach(root => {
    ['Major scale', 'Harmonic Minor scale', 'Melodic Minor scale'].forEach(type => {
        addCombo('Scale', root, type, 120, 4, 'hands together');
    });
});
// 2. Chromatic Similar
['Bb', 'D'].forEach(root => addCombo('Chromatic', root, 'Chromatic in similar motion', 120, 4, 'hands together'));
// 3. Chromatic Contrary
addCombo('Chromatic', 'Eb', 'Chromatic in contrary motion', 120, 2, 'hands together');
// 4. Scale in 3rds (C Major, Legato ONLY)
addCombo('Scale', 'C', 'Major scale in 3rds', 60, 1, 'hands separately', true);
// 5. Arpeggios (Bb, D variants)
['Bb', 'D'].forEach(root => {
    ['Major arpeggio', 'Minor arpeggio', 'Diminished 7th arpeggio', 'Dominant 7th arpeggio'].forEach(type => {
        addCombo('Arpeggio', root, type, 100, 4, 'hands together');
    });
});

// --- STATE & STORAGE ---
let currentItem = null;
let history = JSON.parse(localStorage.getItem('trinityData')) || {};

function saveHistory() {
    localStorage.setItem('trinityData', JSON.stringify(history));
}

// --- SMART ALGORITHM ---
function calculateAverages() {
    let stats = { totalSum: 0, totalCount: 0, categories: {}, dynamics: {}, articulations: {}, specificItems: {} };
    
    // Initialize stats
    combinations.forEach(c => {
        if (!stats.categories[c.category]) stats.categories[c.category] = { sum: 0, count: 0 };
        if (!stats.dynamics[c.dynamic]) stats.dynamics[c.dynamic] = { sum: 0, count: 0 };
        if (!stats.articulations[c.articulation]) stats.articulations[c.articulation] = { sum: 0, count: 0 };
        
        // Combine Root + Type for the itemized list (e.g. "Bb Major scale")
        let itemName = `${c.root} ${c.type}`;
        if (!stats.specificItems[itemName]) stats.specificItems[itemName] = { sum: 0, count: 0 };
    });

    for (let id in history) {
        let scores = history[id];
        let combo = combinations.find(c => c.id === id);
        if (!combo) continue;
        
        let itemName = `${combo.root} ${combo.type}`;

        scores.forEach(score => {
            stats.totalSum += score;
            stats.totalCount++;
            
            stats.categories[combo.category].sum += score;
            stats.categories[combo.category].count++;
            
            stats.dynamics[combo.dynamic].sum += score;
            stats.dynamics[combo.dynamic].count++;
            
            stats.articulations[combo.articulation].sum += score;
            stats.articulations[combo.articulation].count++;
            
            stats.specificItems[itemName].sum += score;
            stats.specificItems[itemName].count++;
        });
    }
    return stats;
}

function getAverage(statObj) {
    return statObj.count === 0 ? null : statObj.sum / statObj.count;
}

function selectNextPrompt() {
    const stats = calculateAverages();
    
    // Calculate global variable modifiers (The "Smarts")
    let artWeights = {};
    arts.forEach(a => {
        let avg = getAverage(stats.articulations[a]);
        artWeights[a] = (avg === null) ? 1.0 : Math.max(0.5, (10 - avg) / 3); 
    });

    // Score items
    let poolWeights = combinations.map(c => {
        let itemScores = history[c.id] || [];
        let itemAvg = itemScores.length > 0 ? (itemScores.reduce((a,b)=>a+b,0)/itemScores.length) : null;
        
        // Base weight: Unplayed items have high weight (100). Played items scale based on score.
        let weight = (itemAvg === null) ? 100 : Math.max(10, (11 - itemAvg) * 10);
        
        // Apply smart variable multiplier
        weight = weight * (artWeights[c.articulation] || 1);
        return { item: c, weight: weight };
    });

    // Weighted random selection
    let totalWeight = poolWeights.reduce((sum, pw) => sum + pw.weight, 0);
    let randomNum = Math.random() * totalWeight;
    
    let weightSum = 0;
    for (let pw of poolWeights) {
        weightSum += pw.weight;
        if (randomNum <= weightSum) return pw.item;
    }
    return combinations[Math.floor(Math.random() * combinations.length)];
}

// --- APP LOGIC ---
const btnNext = document.getElementById('btn-next');
const scoringSection = document.getElementById('scoring-section');
const promptText = document.getElementById('prompt-text');
const promptSubtext = document.getElementById('prompt-subtext');

function generateSpeechText(c) {
    let root = c.root.replace('b', ' flat');
    let dyn = c.dynamic === 'f' ? 'forte' : c.dynamic === 'mf' ? 'mezzo forte' : 'piano';
    return `Play the ${root} ${c.type}, ${dyn}, ${c.articulation}`;
}

btnNext.addEventListener('click', () => {
    currentItem = selectNextPrompt();
    
    promptText.innerText = `${currentItem.root} ${currentItem.type}\n${currentItem.dynamic} • ${currentItem.articulation}`;
    promptSubtext.innerText = `Min BPM: ${currentItem.bpm} | ${currentItem.octaves} Octave(s) | ${currentItem.hands}`;
    
    btnNext.classList.add('hidden');
    scoringSection.classList.remove('hidden');

    const speechText = generateSpeechText(currentItem);
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.9; 
    window.speechSynthesis.cancel(); 
    window.speechSynthesis.speak(utterance);
});

// Scoring Buttons
document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let score = parseInt(e.target.getAttribute('data-score'));
        if (!history[currentItem.id]) history[currentItem.id] = [];
        history[currentItem.id].push(score);
        
        if (history[currentItem.id].length > 5) history[currentItem.id].shift();
        
        saveHistory();
        btnNext.click();
    });
});

// --- NAVIGATION & ANALYTICS ---
const navExam = document.getElementById('nav-exam');
const navAnalytics = document.getElementById('nav-analytics');
const viewExam = document.getElementById('view-exam');
const viewAnalytics = document.getElementById('view-analytics');

function switchView(view) {
    if (view === 'exam') {
        navExam.classList.add('active');
        navAnalytics.classList.remove('active');
        viewExam.classList.add('active');
        viewExam.classList.remove('hidden');
        viewAnalytics.classList.remove('active');
        viewAnalytics.classList.add('hidden');
    } else {
        navAnalytics.classList.add('active');
        navExam.classList.remove('active');
        viewAnalytics.classList.add('active');
        viewAnalytics.classList.remove('hidden');
        viewExam.classList.remove('active');
        viewExam.classList.add('hidden');
        renderAnalytics();
    }
}

navExam.addEventListener('click', () => switchView('exam'));
navAnalytics.addEventListener('click', () => switchView('analytics'));

function renderAnalytics() {
    const stats = calculateAverages();
    
    const formatScore = (statObj) => {
        let avg = getAverage(statObj);
        return avg === null ? '-' : avg.toFixed(1) + ' / 10';
    };

    document.getElementById('stat-overall').innerText = stats.totalCount === 0 ? '-' : (stats.totalSum / stats.totalCount).toFixed(1) + ' / 10';
    
    document.getElementById('stat-legato').innerText = formatScore(stats.articulations['legato'] || {count:0});
    document.getElementById('stat-staccato').innerText = formatScore(stats.articulations['staccato'] || {count:0});
    
    document.getElementById('stat-forte').innerText = formatScore(stats.dynamics['f'] || {count:0});
    document.getElementById('stat-mf').innerText = formatScore(stats.dynamics['mf'] || {count:0});
    document.getElementById('stat-piano').innerText = formatScore(stats.dynamics['p'] || {count:0});
    
    document.getElementById('stat-scales').innerText = formatScore(stats.categories['Scale'] || {count:0});
    document.getElementById('stat-arps').innerText = formatScore(stats.categories['Arpeggio'] || {count:0});
    document.getElementById('stat-chromatics').innerText = formatScore(stats.categories['Chromatic'] || {count:0});

    // Render Specific Items
    const specificItemsContainer = document.getElementById('stat-specific-items');
    specificItemsContainer.innerHTML = ''; 

    // Convert object to array for sorting
    let itemsArray = Object.keys(stats.specificItems).map(itemName => {
        return {
            name: itemName,
            avg: getAverage(stats.specificItems[itemName])
        };
    });

    // Sort: Weakest (lowest scores) at the top. Unplayed items at the bottom.
    itemsArray.sort((a, b) => {
        if (a.avg === null && b.avg === null) return a.name.localeCompare(b.name);
        if (a.avg === null) return 1;
        if (b.avg === null) return -1;
        return a.avg - b.avg;
    });

    itemsArray.forEach(item => {
        let row = document.createElement('div');
        row.className = 'item-row';
        
        let nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.innerText = item.name;

        let scoreSpan = document.createElement('span');
        scoreSpan.className = 'item-score';
        scoreSpan.innerText = item.avg === null ? '-' : item.avg.toFixed(1);
        
        // Color code scores: red for weak (<6), green for strong (>=8)
        if (item.avg !== null) {
            if (item.avg < 6) scoreSpan.style.color = '#ff9800'; // Orange/Warning
            if (item.avg >= 8) scoreSpan.style.color = '#4caf50'; // Green/Good
        }

        row.appendChild(nameSpan);
        row.appendChild(scoreSpan);
        specificItemsContainer.appendChild(row);
    });
}

document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm("Are you sure you want to reset all your practice data? This cannot be undone.")) {
        history = {};
        saveHistory();
        renderAnalytics();
    }
});