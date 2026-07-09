// ==========================================================================
// 1️⃣ إدارة الثيم الفورية (تغيير فوري للون قبل ما الشاشة ترسم لمنع الوميض)
// ==========================================================================
let savedTheme = localStorage.getItem('user-game-theme');
if (savedTheme) {
    let themeColors = { 'crimson': '#ff2a5f', 'blue': '#3498db', 'green': '#2ecc71', 'purple': '#9b59b6', 'gold': '#f1c40f' };
    if (themeColors[savedTheme]) {
        document.documentElement.style.setProperty('--crimson', themeColors[savedTheme]);
    }
}

// ==========================================================================
// 2️⃣ متغيرات حالة اللعبة العامة (State Management)
// ==========================================================================
let gameData = null;
let players = [];
let gameSettings = {
    timeLimit: 5,
    roles: [],
    useCustomChallenges: false,
    customChallengesList: []
};
let currentRoleIndex = 0;
let isSpecialistModeActive = false;
let specialistChallengesList = [];
let selectedGameTime = 5;
const totalAvatarsCount = 10;
let availableAvatars = [];

// --- متغيرات التحكم بالمحكمة والتايمر الدائري ---
let gameTimerInterval = null;
let secondsLeft = 0;
let totalDuration = 0;
let isTimerPaused = false;
let eventTriggerTimeInSeconds = 20; // التحكم كله من هنا يا باشا!

// ==========================================================================
// 3️⃣ إدارة المؤثرات الصوتية والاهتزازات المركزية
// ==========================================================================
let isVibrationEnabled = true;
let isSoundEnabled = true;

const errorSound = new Audio('../sounds/error.m4a');
const alertSound = new Audio('../sounds/alert.mp3');
const soundOn = new Audio('../sounds/toggleon.mp3');
const soundOff = new Audio('../sounds/toggleoff.mp3');
const clickSound = new Audio('../sounds/click.mp3');
const removeSound = new Audio('../sounds/remove.mp3');
const swipeSound = new Audio('../sounds/swip.mp3');
const courtroomTypewriterSound = new Audio('../sounds/teyping.mp3');
courtroomTypewriterSound.loop = true;
const countdownTickSound = new Audio('../sounds/count.mp3');
const victorySound = new Audio('../sounds/succses.mp3');
const zeroingSound = new Audio('../sounds/zeroing.mp3');
let isZeroingSoundPlayed = false;
const timerDangerSound = new Audio('../sounds/timer.mp3');
timerDangerSound.loop = true;
let isTimerDangerSoundPlayed = false;
const whistleSound = new Audio('../sounds/whistle.mp3');
const startSound = new Audio('../sounds/start.mp3');
const addSound = new Audio('../sounds/add.mp3');

const continuousSounds = [
    courtroomTypewriterSound,
    timerDangerSound,
    zeroingSound,
    victorySound,
    swipeSound
];

function forcePreloadAllSounds() {
    const allSounds = [
        errorSound, alertSound, soundOn, soundOff, clickSound,
        removeSound, swipeSound, courtroomTypewriterSound,
        countdownTickSound, victorySound, zeroingSound,
        timerDangerSound, whistleSound, startSound, addSound
    ];
    allSounds.forEach(sound => {
        if (sound) sound.preload = 'auto';
    });
}

document.addEventListener("DOMContentLoaded", () => {
    forcePreloadAllSounds();
});

function playGameSound(audioObject) {
    if (!isSoundEnabled || !audioObject) return;
    continuousSounds.forEach(sound => {
        if (sound && !sound.paused && sound !== audioObject) {
            sound.pause();
            sound.currentTime = 0;
        }
    });
    audioObject.currentTime = 0;
    audioObject.play().catch(e => console.log("تم حجب الصوت بواسطة سياسة المتصفح:", e));
}

function triggerGameVibrate(pattern) {
    if (isVibrationEnabled && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

window.playGameSound = playGameSound;
window.triggerGameVibrate = triggerGameVibrate;

// ==========================================================================
// 4️⃣ دورة حياة التطبيق والتشغيل الأوفلاين (Cordova & Browser Lifecycle)
// ==========================================================================
localStorage.removeItem('lobby_players');

if (window.cordova) {
    document.addEventListener('deviceready', initApp, false);
} else {
    window.addEventListener('load', () => {
        console.log("وضع المتصفح: تخطي deviceready 🔥");
        initApp();
    });
}

// 1. تعريف المتغير في الـ Global Scope فوق خالص
window.gameData = null;

// 2. دالة تحميل الـ JSON أول ما اللعبة تفتح
async function loadGameData() {
    try {
        const response = await fetch('../gameData.json'); // تأكد من المسار الصح للملف
        const data = await response.json();

        // التخزين في الحتتين عشان نريح الجافا سكريبت
        window.gameData = data;
        gameData = data;

        console.log("✅ تم تحميل ملف gameData.json بنجاح والداتا جاهزة!", data);
    } catch (error) {
        console.error("❌ فشل في تحميل ملف الـ JSON، تأكد من المسار أو الـ Syntax:", error);
    }
}

// 3. تشغيل الدالة فوراً مع بداية تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGameData);
} else {
    loadGameData();
}

async function initApp() {
    console.log("التطبيق جاهز للعمل أوفلاين! 🚀");
    await loadGameData();
    if (typeof refreshAvatarsPool === "function") refreshAvatarsPool();
    initEventListeners();
    if (navigator.splashscreen) navigator.splashscreen.hide();
    if (typeof handleIntroVideo === "function") handleIntroVideo();
    if (typeof loadLobbyPlayers === "function") loadLobbyPlayers();
}

// ==========================================================================
// 5️⃣ سحب البيانات أوفلاين (تحميل ملف الـ JSON الخارجي)
// ==========================================================================
async function loadGameData() {
    try {
        const response = await fetch('gameData.json');
        if (!response.ok) throw new Error("لم نتمكن من تحميل ملف القضايا والتحصينات");
        gameData = await response.json();
        console.log("✅ تم تحميل القضايا والتحديات بنجاح من challenges.json:", gameData);
    } catch (error) {
        console.error("❌ حدث خطأ أثناء تحميل الملف، سيتم تشغيل البيانات الاحتياطية:", error);
        if (typeof setupFallbackData === "function") setupFallbackData();
    }
}

// ==========================================================================
// 6️⃣ ربط الأحداث (Event Listeners)
// ==========================================================================
function initEventListeners() {
    console.log("🔥 initEventListeners Called");
    console.log("🔄 جاري ربط جميع عناصر الـ DOM والأحداث بدون تكرار وبكفاءة...");

    // [1] إعدادات الثيم والألوان
    if (typeof savedTheme !== 'undefined' && savedTheme) {
        let radioBtn = document.querySelector(`input[name="game-theme"][value="${savedTheme}"]`);
        if (radioBtn) radioBtn.checked = true;
    }

    document.querySelectorAll('input[name="game-theme"]').forEach(radio => {
        radio.addEventListener('change', function () {
            let selectedTheme = this.value;
            let themeColors = { 'crimson': '#ff2a5f', 'blue': '#3498db', 'green': '#2ecc71', 'purple': '#9b59b6', 'gold': '#f1c40f' };
            if (themeColors[selectedTheme]) {
                document.documentElement.style.setProperty('--crimson', themeColors[selectedTheme]);
                localStorage.setItem('user-game-theme', selectedTheme);
                localStorage.setItem('user-theme', selectedTheme);
            }
        });
    });

    const themeModeToggle = document.getElementById('theme-mode-toggle');
    if (themeModeToggle) {
        themeModeToggle.addEventListener('change', (e) => {
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                if (e.target.checked) appContainer.classList.add('classic-theme');
                else appContainer.classList.remove('classic-theme');
            }
        });
    }

    // [2] سويتشات التحكم المركزية
    const soundToggle = document.getElementById("sound-effects-toggle");
    if (soundToggle) {
        isSoundEnabled = soundToggle.checked;
        soundToggle.addEventListener("change", () => {
            isSoundEnabled = soundToggle.checked;
            playGameSound(isSoundEnabled ? soundOn : soundOff);
        });
    }

    const vibrationToggle = document.getElementById("vibration-toggle");
    if (vibrationToggle) {
        isVibrationEnabled = vibrationToggle.checked;
        vibrationToggle.addEventListener("change", () => {
            isVibrationEnabled = vibrationToggle.checked;
            if (isVibrationEnabled) {
                playGameSound(soundOn);
                if (navigator.vibrate) navigator.vibrate(50);
            } else {
                playGameSound(soundOff);
            }
        });
    }

    const specialistModeToggle = document.getElementById('specialist-mode-toggle');
    if (specialistModeToggle) {
        specialistModeToggle.addEventListener('change', (e) => {
            isSpecialistModeActive = e.target.checked;
            playGameSound(isSpecialistModeActive ? soundOn : soundOff);
            const badge = document.getElementById('specialist-badge');
            if (badge) {
                if (isSpecialistModeActive) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }
        });
    }

    const customToggle = document.getElementById('custom-challenges-toggle');
    if (customToggle) {
        customToggle.addEventListener('change', (e) => {
            const customArea = document.getElementById('custom-challenges-area');
            if (customArea) {
                if (e.target.checked) customArea.classList.remove('hidden');
                else customArea.classList.add('hidden');
            }
        });
    }

    // [3] أزرار التنقل وشاشات اللعبة الرئيسية
    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
        btnStartGame.addEventListener('click', () => {
            console.log("🔊 جاري فك حظر الأصوات من المتصفح...");
            const allSounds = [soundOn, soundOff, clickSound, removeSound, swipeSound, errorSound, alertSound, courtroomTypewriterSound, countdownTickSound, victorySound, zeroingSound, timerDangerSound, whistleSound, startSound];
            allSounds.forEach(sound => {
                if (sound) {
                    sound.play().then(() => { sound.pause(); sound.currentTime = 0; }).catch(e => console.log("تم تخطي صوت غير جاهز بعد أو تم فكه مسبقاً"));
                }
            });
            if (typeof switchScreen === "function") switchScreen('screen-lobby');
            if (typeof loadLobbyPlayers === "function") loadLobbyPlayers();
        });
    }

    const btnOpenSettings = document.getElementById('btn-open-settings');
    if (btnOpenSettings) btnOpenSettings.addEventListener('click', () => { if (typeof switchScreen === "function") switchScreen('screen-settings'); });

    const btnBackFromSettings = document.getElementById('btn-back-from-settings');
    if (btnBackFromSettings) btnBackFromSettings.addEventListener('click', () => { if (typeof switchScreen === "function") switchScreen('screen-main'); });

    const btnBackToMain = document.getElementById('btn-back-to-main');
    if (btnBackToMain) btnBackToMain.addEventListener('click', () => { if (typeof switchScreen === "function") switchScreen('screen-main'); });

    // [4] إدارة اللوبي وإضافة اللاعبين
    const btnAddPlayer = document.getElementById('btn-add-player');
    if (btnAddPlayer && typeof addPlayerFromInput === "function") btnAddPlayer.addEventListener('click', addPlayerFromInput);

    const playerNameInput = document.getElementById('player-name-input');
    if (playerNameInput && typeof addPlayerFromInput === "function") {
        playerNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPlayerFromInput(); });
    }

    // [5] أزرار الـ Gameplay والتفاعل والأصوات المباشرة
    const gameButtons = [
        { id: "btn-share-ideas", sound: clickSound }, { id: "btn-support-mail", sound: clickSound },
        { id: "btn-i-am-player", sound: clickSound }, { id: "btn-expel-player", sound: removeSound },
        { id: "btn-master-reveal", sound: swipeSound }, { id: "btn-vote-success-init", sound: clickSound },
        { id: "btn-vote-failed-init", sound: clickSound }, { id: "btn-vote-caught", sound: clickSound },
        { id: "btn-verify-true", sound: clickSound }, { id: "btn-verify-false", sound: clickSound }
    ];
    gameButtons.forEach(btnConfig => {
        const btn = document.getElementById(btnConfig.id);
        if (btn) btn.addEventListener("click", () => playGameSound(btnConfig.sound));
    });

    const shareIdeasBtn = document.getElementById('btn-share-ideas');
    if (shareIdeasBtn) {
        shareIdeasBtn.addEventListener('click', function () {
            window.open("https://forms.gle/WbiNNDuXsMCGHMJJ8", '_system');
        });
    }

    const btnSupportMail = document.getElementById('btn-support-mail');
    if (btnSupportMail) {
        btnSupportMail.addEventListener('click', function () {
            let phoneNumber = "201050041446";
            let messageText = "اهلاا يا عمر! 👋🔥\n\nأنا جاي من جوة لعبة 'في الاستخبُص' وكنت حابب اتكلم معاك في موضوع سريع :\n💬 [اكتب حوارك السريع، رأيك، أو فكرة بيزنس وتطوير هنا]\n\n";
            window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`, '_blank');
        });
    }

    // [6] منطق مود المتخصص والعداد وجاهزين في اللوبي
    const btnBackSpecialistToLobby = document.getElementById('btn-back-specialist-to-lobby');
    if (btnBackSpecialistToLobby) btnBackSpecialistToLobby.addEventListener('click', () => { if (typeof switchScreen === "function") switchScreen('screen-lobby'); });

    const btnSendSpecialistChallenge = document.getElementById('btn-send-specialist-challenge');
    const specialistChallengeInput = document.getElementById('specialist-challenge-input');
    if (btnSendSpecialistChallenge && specialistChallengeInput) {
        btnSendSpecialistChallenge.addEventListener('click', () => {
            const text = specialistChallengeInput.value.trim();
            if (!text) return;
            specialistChallengesList.push(text);
            specialistChallengeInput.value = "";
            const insertedCountEl = document.getElementById('inserted-challenges-count');
            if (insertedCountEl) insertedCountEl.innerText = specialistChallengesList.length;
            const requiredCount = players.length;
            if (specialistChallengesList.length >= requiredCount) {
                const alertCounter = document.getElementById('specialist-alert-counter');
                if (alertCounter) alertCounter.style.display = 'none';
                const btnSubmitSpecialistGame = document.getElementById('btn-submit-specialist-game');
                if (btnSubmitSpecialistGame) {
                    btnSubmitSpecialistGame.removeAttribute('disabled');
                    btnSubmitSpecialistGame.classList.remove('disabled-btn');
                }
            }
        });
    }

    const btnSubmitSpecialistGame = document.getElementById('btn-submit-specialist-game');
    if (btnSubmitSpecialistGame) btnSubmitSpecialistGame.addEventListener('click', () => { if (typeof startRolesDistribution === "function") startRolesDistribution(); });

    const btnLobbyReady = document.getElementById('btn-lobby-ready');
    if (btnLobbyReady) {
        btnLobbyReady.addEventListener('click', () => {
            if (players.length < 3) {
                playGameSound(errorSound);
                if (typeof triggerGameVibrate === "function") triggerGameVibrate([80, 80, 250]);
                if (typeof showCustomToast === "function") showCustomToast(" ⚠️ الجيم محتاج على الأقل 3 لعيبة علشان تدخلوا ");
                return;
            }
            if (isSpecialistModeActive) {
                specialistChallengesList = [];
                if (document.getElementById('inserted-challenges-count')) document.getElementById('inserted-challenges-count').innerText = "0";
                if (document.getElementById('required-challenges-count')) document.getElementById('required-challenges-count').innerText = players.length;
                const alertCounter = document.getElementById('specialist-alert-counter');
                if (alertCounter) alertCounter.style.display = 'block';
                if (specialistChallengeInput) specialistChallengeInput.value = "";
                const btnSubmitSpecialistGameBtn = document.getElementById('btn-submit-specialist-game');
                if (btnSubmitSpecialistGameBtn) {
                    btnSubmitSpecialistGameBtn.setAttribute('disabled', 'true');
                    btnSubmitSpecialistGameBtn.classList.add('disabled-btn');
                }
                if (typeof switchScreen === "function") switchScreen('screen-specialist-challenges');
            } else {
                if (typeof startRolesDistribution === "function") startRolesDistribution();
            }
        });
    }

    const btnRoleDone = document.getElementById('btn-role-done');
    if (btnRoleDone) btnRoleDone.addEventListener('click', () => { if (typeof nextPlayerRoleTurn === "function") nextPlayerRoleTurn(); });

    // [7] ساحة المحكمة والتصويت والإنهاء
    const courtBackBtn = document.getElementById('court-back-btn');
    const confirmModal = document.getElementById('custom-confirm-modal');
    const confirmYesBtn = document.getElementById('btn-confirm-yes');
    const confirmNoBtn = document.getElementById('btn-confirm-no');

    if (courtBackBtn) {
        courtBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isTimerPaused = true;
            if (confirmModal) confirmModal.classList.remove('hidden');
        });
    }

    if (confirmNoBtn) {
        confirmNoBtn.onclick = function () {
            if (confirmModal) confirmModal.classList.add('hidden');
            const courtScreen = document.getElementById('screen-court');
            if (courtScreen && !courtScreen.classList.contains('hidden')) isTimerPaused = false;
        };
    }

    const btnChaosVote = document.getElementById('btn-chaos-vote');
    const voteConfirmModal = document.getElementById('vote-confirm-modal');
    const btnVoteYes = document.getElementById('btn-vote-yes');
    const btnVoteNo = document.getElementById('btn-vote-no');

    if (btnChaosVote) {
        btnChaosVote.addEventListener('click', () => {
            isTimerPaused = true;
            if (voteConfirmModal) voteConfirmModal.classList.remove('hidden');
        });
    }

    if (btnVoteNo) {
        btnVoteNo.addEventListener('click', () => {
            if (voteConfirmModal) voteConfirmModal.classList.add('hidden');
            isTimerPaused = false;
        });
    }

    if (btnVoteYes) {
        btnVoteYes.addEventListener('click', () => {
            if (voteConfirmModal) voteConfirmModal.classList.add('hidden');
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            console.log("⚡ الانتقال فوراً للتصويت...");
            if (typeof startVotingPhase === "function") startVotingPhase();
        });
    }

    if (confirmYesBtn) {
        confirmYesBtn.onclick = function () {
            if (confirmModal) confirmModal.classList.add('hidden');
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            const selectorsToClear = ['.roles-challenge-text', '#challenge-text-content', '.roles-badge-element', '#player-role-badge'];
            selectorsToClear.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) {
                    if (el.tagName === 'DIV' || el.tagName === 'P') el.innerHTML = '';
                    else el.innerText = '';
                }
            });
            const doneBtn = document.getElementById('btn-role-done');
            if (doneBtn) doneBtn.classList.add('hidden');
            const cardContent = document.getElementById('secret-card-content');
            if (cardContent) {
                cardContent.style.opacity = '0';
                cardContent.classList.remove('revealed-glow');
            }
            const coverCard = document.getElementById('swipe-cover-card');
            if (coverCard) {
                coverCard.classList.remove('fly-away-left');
                coverCard.style.transform = 'none';
                coverCard.style.opacity = '1';
            }
            gameSettings.roles = [];
            currentRoleIndex = 0;
            isTimerPaused = false;
            if (typeof switchScreen === "function") switchScreen('screen-lobby');
        };
    }

    const btnPullDrawer = document.getElementById('btn-pull-drawer');
    if (btnPullDrawer) btnPullDrawer.addEventListener('click', () => { const drawer = document.getElementById('secret-drawer'); if (drawer) drawer.classList.add('open'); });
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', () => { const drawer = document.getElementById('secret-drawer'); if (drawer) drawer.classList.remove('open'); });

    // [8] إعادة اللعب والإنهاء النهائي وTime Chips وHelp Modal
    const btnRestartSame = document.getElementById('btn-restart-same');
    if (btnRestartSame) {
        btnRestartSame.onclick = function () {
            if (typeof handleArcadeVoteSlam === "function") {
                handleArcadeVoteSlam(() => {
                    players.forEach(p => { p.score = 0; p.isDead = false; });
                    votingIndex = 0;
                    isChallengeRevealed = false;
                    isConfrontationMode = false;
                    gameSettings.roles = [];
                    if (typeof resetSpecialistModeState === "function") resetSpecialistModeState();
                    if (typeof saveLobbyPlayers === "function") saveLobbyPlayers();
                    if (typeof renderPlayers === "function") renderPlayers();
                    if (typeof switchScreen === "function") switchScreen('screen-lobby');
                    playGameSound(alertSound);
                    if (typeof triggerGameVibrate === "function") triggerGameVibrate([80, 80, 250]);
                    if (typeof showCustomToast === "function") showCustomToast(" بدأنا جيم جديد! السكور اتصفر وجاهزين لأسماء جديدة!");
                });
            }
        };
    }

    const btnExitGame = document.getElementById('btn-exit-game');
    if (btnExitGame) {
        btnExitGame.addEventListener('click', () => {
            players = [];
            localStorage.removeItem('lobby_players');
            if (typeof refreshAvatarsPool === "function") refreshAvatarsPool();
            if (typeof renderPlayers === "function") renderPlayers();
            if (typeof resetSpecialistModeState === "function") resetSpecialistModeState();
            gameSettings.roles = [];
            if (typeof switchScreen === "function") switchScreen('screen-main');
        });
    }

    document.querySelectorAll('.time-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const value = this.getAttribute('data-value');
            selectedGameTime = value === "unlimited" ? "unlimited" : parseInt(value, 10);
            console.log("الوقت المختار الحالي:", selectedGameTime);
        });
    });

    const helpBtn = document.getElementById("help-btn-trigger");
    const helpModal = document.getElementById("help-modal");
    const closeHelpBtn = document.getElementById("close-help-btn");
    const modalBody = helpModal ? helpModal.querySelector(".modal-card-body") : null;

    if (helpBtn && helpModal && modalBody) {
        helpBtn.addEventListener("click", () => {
            modalBody.classList.remove("swipe-out-effect");
            helpModal.classList.remove("hidden");
        });
        const closeModalWithSwipe = () => {
            modalBody.classList.add("swipe-out-effect");
            setTimeout(() => { helpModal.classList.add("hidden"); }, 350);
        };
        if (closeHelpBtn) closeHelpBtn.addEventListener("click", closeModalWithSwipe);
        helpModal.addEventListener("click", (e) => { if (e.target === helpModal) closeModalWithSwipe(); });
    }

    console.log("✅ كود نضيف، متصفي، وجاهز للشغل بدون أي كراشات يا ريس!");
}

// ==========================================================================
// 7️⃣ منطق اللوبي (الأفاتار، الرندر، والـ LocalStorage)
// ==========================================================================
function saveLobbyPlayers() {
    localStorage.setItem('lobby_players', JSON.stringify(players));
}

function loadLobbyPlayers() {
    const saved = localStorage.getItem('lobby_players');
    if (saved) players = JSON.parse(saved);
    else players = [];
    refreshAvatarsPool();
    renderPlayers();
}

function refreshAvatarsPool() {
    availableAvatars = [];
    for (let i = 1; i <= 10; i++) {
        const avatar = `./img/avatar${i}.png`;
        if (!players.some(p => p.avatar === avatar)) availableAvatars.push(avatar);
    }
    for (let i = availableAvatars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableAvatars[i], availableAvatars[j]] = [availableAvatars[j], availableAvatars[i]];
    }
}

function getNextUniqueAvatar() {
    if (!window.availableAvatars || availableAvatars.length === 0) refreshAvatarsPool();
    return availableAvatars.shift();
}

function addPlayerFromInput() {
    const input = document.getElementById('player-name-input');
    if (!input) return;

    if (players.length >= 10) {
        playGameSound(errorSound);
        triggerGameVibrate([80, 80, 250]);
        showCustomToast("🚨 انتو كده كتير اوي هما 10 بس!");
        input.value = '';
        return;
    }

    const name = input.value.trim();

    if (name && !players.some(p => p.name === name)) {

        const playerAvatar = getNextUniqueAvatar();

        players.push({
            name: name,
            score: 0,
            avatar: playerAvatar,
            gender: 'M'
        });

        if (typeof addSound !== 'undefined')
            playGameSound(addSound);

        triggerGameVibrate([40]);

        input.value = '';

        saveLobbyPlayers();
        renderPlayers();

    } else if (name) {

        playGameSound(errorSound);
        triggerGameVibrate([100, 50, 100, 50, 100]);
        showCustomToast("⚠️ الاسم ده اتكتب قبل كده !");
    }
}

function renderPlayers() {

    const listContainer = document.getElementById('players-list');
    const currentCountSpan = document.getElementById('current-count');

    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (currentCountSpan)
        currentCountSpan.innerText = players.length;

    players.forEach((player) => {

        const currentGender = player.gender || 'M';

        const genderIcon = currentGender === 'F' ? '' : '';
        const genderClass = currentGender === 'F'
            ? 'badge-girl'
            : 'badge-boy';

        listContainer.innerHTML += `
        <div class="player-chip"
             data-player-name="${player.name}"
             data-gender="${currentGender}">

            <button
                class="remove-player-btn"
                onclick="removePlayer('${player.name}', event); playGameSound(removeSound)">
                ×
            </button>

            <div class="player-info-side">

                <span class="player-name-text">${player.name}</span>

                <div class="avatar-wrapper"
                     onclick="togglePlayerGender('${player.name}', event)"
                     title="اضغط لتغيير ولد / بنت">

                    <img
                        src="${player.avatar}"
                        class="player-avatar"
                        alt="User">

                    <span class="gender-badge ${genderClass}">
                        ${currentGender === 'F' ? 'بنت' : 'ولد'}
                    </span>

                </div>

            </div>

        </div>`;
    });

}

function togglePlayerGender(playerName, event) {
    if (event) event.stopPropagation();
    const player = players.find(p => p.name === playerName);
    if (!player) return;
    player.gender = player.gender === 'F' ? 'M' : 'F';
    if (typeof clickSound !== 'undefined')
        playGameSound(clickSound);
    triggerGameVibrate([25]);
    saveLobbyPlayers();
    renderPlayers();
}

window.removePlayer = function (playerName, e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const clickedBtn = e ? e.target : null;
    let playerChip = clickedBtn ? clickedBtn.closest('.player-chip') : null;
    if (!playerChip) playerChip = document.querySelector(`.player-chip[data-player-name="${playerName}"]`);
    if (!playerChip) return;
    playerChip.classList.add('removing');
    playerChip.style.pointerEvents = 'none';
    const cleanup = () => {
        const targetIndex = players.findIndex(p => p.name === playerName);
        if (targetIndex !== -1) {
            if (window.availableAvatars && players[targetIndex].avatar) {
                availableAvatars.push(players[targetIndex].avatar);
                for (let i = availableAvatars.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [availableAvatars[i], availableAvatars[j]] = [availableAvatars[j], availableAvatars[i]];
                }
            }
            players.splice(targetIndex, 1);
            saveLobbyPlayers();
            renderPlayers();
        }
    };
    let animationHandled = false;
    playerChip.addEventListener('animationend', () => {
        if (!animationHandled) { animationHandled = true; cleanup(); }
    }, { once: true });
    setTimeout(() => {
        if (!animationHandled) { animationHandled = true; cleanup(); }
    }, 200);
};

// ==========================================================================
// 8️⃣ توزيع الأدوار وكارت السحب السري
// ==========================================================================
// 🎰 دالة توليد القضية الذكية (مربوطة بالسيناريو المختار بالملي)
function getRandomFormattedCase() {
    // لو فيه سيناريو متاح حالياً تم اختياره في الـ startRolesDistribution
    if (gameSettings && gameSettings.currentScenario) {
        let current = gameSettings.currentScenario;
        let desc = current.location_desc || "ابدأوا الخناقة!";

        // لو الوصف جواه تعويض لأسامي اللعيبة، بنعوضهم من اللستة الحالية بالترتيب
        if (players && players.length >= 2) {
            // خلط خفيف للأسامي عشان ميبقاش ديماً أول اتنين في اللوبي هما المتهمين
            let shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
            let p1 = shuffledPlayers[0].name || shuffledPlayers[0];
            let p2 = shuffledPlayers[1].name || shuffledPlayers[1];

            desc = desc.replace(/\[PLAYER1\]/g, p1).replace(/\[PLAYER2\]/g, p2);
        }
        return desc;
    }

    return "قضية غامضة مفيش ليها معالم.. اثبت براءتك وبس!";
}

function setupRolesBackButton() {
    const backBtn = document.getElementById('btn-back-from-roles');
    const confirmModal = document.getElementById('custom-confirm-modal');
    const confirmYesBtn = document.getElementById('btn-confirm-yes');
    const confirmNoBtn = document.getElementById('btn-confirm-no');
    if (!backBtn) return;
    backBtn.onclick = function (e) {
        e.preventDefault();
        if (confirmModal) confirmModal.classList.remove('hidden');
    };
    if (confirmNoBtn) {
        confirmNoBtn.onclick = function () { if (confirmModal) confirmModal.classList.add('hidden'); };
    }
    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', function () {
            if (confirmModal) confirmModal.classList.add('hidden');
            const selectorsToClear = ['.roles-challenge-text', '#challenge-text-content', '.roles-badge-element', '#player-role-badge'];
            selectorsToClear.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) {
                    if (el.tagName === 'DIV' || el.tagName === 'P') el.innerHTML = '';
                    else el.innerText = '';
                }
            });
            const doneBtn = document.getElementById('btn-role-done');
            if (doneBtn) doneBtn.classList.add('hidden');
            const cardContent = document.getElementById('secret-card-content');
            if (cardContent) { cardContent.style.opacity = '0'; cardContent.classList.remove('revealed-glow'); }
            const coverCard = document.getElementById('swipe-cover-card');
            if (coverCard) { coverCard.classList.remove('fly-away-left'); coverCard.style.transform = 'none'; coverCard.style.opacity = '1'; }
            specialistChallengesList = [];
            gameSettings.roles = [];
            currentRoleIndex = 0;
            const insertedCounter = document.getElementById('inserted-challenges-count');
            if (insertedCounter) insertedCounter.innerText = "0";
            setTimeout(() => {
                const challengeInput = document.getElementById('specialist-challenge-input');
                const sendBtn = document.getElementById('btn-send-specialist-challenge');
                const submitGameBtn = document.getElementById('btn-submit-specialist-game');
                if (challengeInput) { challengeInput.disabled = false; challengeInput.placeholder = "اكتب التحدي السري هنا..."; challengeInput.value = ""; }
                if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = "1"; sendBtn.style.pointerEvents = "auto"; }
                if (submitGameBtn) { submitGameBtn.setAttribute('disabled', 'true'); submitGameBtn.classList.add('disabled-btn'); submitGameBtn.style.background = ''; }
                console.log("🧼 تم تنظيف وفتح أزرار المتخصص بنجاح من شاشة الأدوار!");
            }, 50);
            switchScreen('screen-lobby');
        });
    }
}

function setupSpecialistBackButton() {
    const backBtn = document.getElementById('btn-back-specialist-to-lobby');
    if (!backBtn) return;
    backBtn.onclick = function (e) {
        e.preventDefault();
        const challengeInput = document.getElementById('specialist-challenge-input');
        const sendBtn = document.getElementById('btn-send-specialist-challenge');
        const submitGameBtn = document.getElementById('btn-submit-specialist-game');
        const insertedCounter = document.getElementById('inserted-challenges-count');
        if (insertedCounter) insertedCounter.innerText = "0";
        if (challengeInput) { challengeInput.disabled = false; challengeInput.placeholder = "اكتب التحدي السري هنا..."; challengeInput.value = ""; }
        if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.5"; sendBtn.style.pointerEvents = "none"; }
        if (submitGameBtn) { submitGameBtn.setAttribute('disabled', 'true'); submitGameBtn.classList.add('disabled-btn'); submitGameBtn.style.background = ''; }
        specialistChallengesList = [];
        switchScreen('screen-lobby');
    };
}

document.getElementById('specialist-challenge-input').addEventListener('input', function () {
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    if (!sendBtn) return;
    if (this.value.trim().length > 0) {
        sendBtn.removeAttribute('disabled');
        sendBtn.classList.remove('disabled-btn');
        sendBtn.style.opacity = "1";
        sendBtn.style.pointerEvents = "auto";
        sendBtn.style.filter = "none";
    } else {
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.classList.add('disabled-btn');
        sendBtn.style.opacity = "0.5";
        sendBtn.style.pointerEvents = "none";
    }
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupSpecialistBackButton);
else setupSpecialistBackButton();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupRolesBackButton);
else setupRolesBackButton();

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ==========================================================================
// 8️⃣ توزيع الأدوار والسيناريوهات الجديدة (الاستخبص)
// ==========================================================================


// 🧼 دالة مساعدة مركزية لإعادة تهيئة حقول المتخصص (عشان مانكررش الكود)
function resetSpecialistInputs() {
    const challengeInput = document.getElementById('specialist-challenge-input');
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    const submitGameBtn = document.getElementById('btn-submit-specialist-game');
    const insertedCounter = document.getElementById('inserted-challenges-count');

    if (insertedCounter) insertedCounter.innerText = "0";
    if (challengeInput) {
        challengeInput.disabled = false;
        challengeInput.placeholder = "اكتب التحدي السري هنا...";
        challengeInput.value = "";
    }
    if (sendBtn) {
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.style.opacity = "0.5";
        sendBtn.style.pointerEvents = "none";
    }
    if (submitGameBtn) {
        submitGameBtn.setAttribute('disabled', 'true');
        submitGameBtn.classList.add('disabled-btn');
        submitGameBtn.style.background = '';
    }
    specialistChallengesList = [];
}

// ↩️ إعداد زر الرجوع من شاشة الأدوار
function setupRolesBackButton() {
    const backBtn = document.getElementById('btn-back-from-roles');
    const confirmModal = document.getElementById('custom-confirm-modal');

    if (!backBtn) return;

    backBtn.onclick = (e) => {
        e.preventDefault();
        if (confirmModal) confirmModal.classList.remove('hidden');
    };

    document.getElementById('btn-confirm-no').onclick = () => {
        if (confirmModal) confirmModal.classList.add('hidden');
    };

    document.getElementById('btn-confirm-yes').onclick = () => {
        if (confirmModal) confirmModal.classList.add('hidden');

        // تنظيف واجهة الكروت بـ Loop ذكية
        ['.roles-challenge-text', '#challenge-text-content', '.roles-badge-element', '#player-role-badge'].forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.innerHTML = '';
        });

        const doneBtn = document.getElementById('btn-role-done');
        if (doneBtn) doneBtn.classList.add('hidden');

        const cardContent = document.getElementById('secret-card-content');
        if (cardContent) {
            cardContent.style.opacity = '0';
            cardContent.classList.remove('revealed-glow');
        }

        const coverCard = document.getElementById('swipe-cover-card');
        if (coverCard) {
            coverCard.classList.remove('fly-away-left');
            coverCard.style.transform = 'none';
            coverCard.style.opacity = '1';
        }

        gameSettings.roles = [];
        currentRoleIndex = 0;

        setTimeout(resetSpecialistInputs, 50);
        console.log("🧼 تم تنظيف شاشة الأدوار والرجوع للوبي!");
        switchScreen('screen-lobby');
    };
}

// ↩️ إعداد زر الرجوع من شاشة المتخصص
function setupSpecialistBackButton() {
    const backBtn = document.getElementById('btn-back-specialist-to-lobby');
    if (!backBtn) return;

    backBtn.onclick = (e) => {
        e.preventDefault();
        resetSpecialistInputs();
        switchScreen('screen-lobby');
    };
}

// 📝 مراقبة حقل إدخال التحدي للمتخصص تفعيل/تعطيل الزرار
document.getElementById('specialist-challenge-input').addEventListener('input', function () {
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    if (!sendBtn) return;

    if (this.value.trim().length > 0) {
        sendBtn.removeAttribute('disabled');
        sendBtn.classList.remove('disabled-btn');
        sendBtn.style.cssText = "opacity: 1; pointer-events: auto; filter: none;";
    } else {
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.classList.add('disabled-btn');
        sendBtn.style.cssText = "opacity: 0.5; pointer-events: none;";
    }
});

// 🔄 تشغيل تهيئة الأزرار أول ما الصفحة تجهز
const initButtons = () => { setupSpecialistBackButton(); setupRolesBackButton(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initButtons);
else initButtons();

// 🎲 دالة الشفل السريعة
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}



// ==========================================================================
// 🚀 الـ Logic المطور لتوزيع الأدوار وصمام أمان الـ JSON
// ==========================================================================

function startRolesDistribution() {
    const errorSound = new Audio('../sounds/error.m4a');

    // الحد الأدنى 3 لعيبة عشان المتعة والـ VIP
    if (players.length < 3) {
        playGameSound(errorSound);
        triggerGameVibrate([80, 80, 250]);
        showCustomToast(" ⚠️ الجيم محتاج على الأقل 3 لعيبة علشان تدخلوا ");
        return;
    }

    // 🛡️ صمام الأمان الحديدي المطور
    if (typeof gameData === 'undefined' || !gameData || !gameData.scenarios || !gameData.challenges || gameData.scenarios.length === 0) {
        console.error("🚨 يا عمر الـ gameData مش متعرّفة أو ملهاش وجود جوه الـ JSON!");
        showCustomToast("⚠️ عطل في قراءة ملف السيناريوهات! جاري تشغيل داتا الطوارئ...");

        const fallbackData = {
            scenarios: [{
                "id": "emergency_01",
                "title": "🚌 ميكروباص الطوارئ",
                "roles": [
                    { "name": "السواق المستعجل", "bio": "عايز يلم الأجرة ويطير." },
                    { "name": "الراكب الغلبان", "bio": "قاعد في حاله ومش طالبة خناق." },
                    { "name": "المواطن المستفز", "bio": "بيتكلم بصوت عالي في الموبايل." }
                ]
            }],
            challenges: [{ "text": "اتكلم بثقة وبس" }],
            cases: ["قضية طوارئ بين [PLAYER1] و [PLAYER2]"]
        };

        window.gameData = fallbackData;
        gameData = fallbackData;
    }

    gameSettings.timeLimit = selectedGameTime;
    gameSettings.roles = [];

    // 1. اختار سيناريو عشوائي
    let scenariosList = (gameData && gameData.scenarios) ? gameData.scenarios : window.gameData.scenarios;
    let selectedScenario = scenariosList[Math.floor(Math.random() * scenariosList.length)];
    gameSettings.currentScenario = selectedScenario;

    // 2. خلط الأدوار المتاحة
    let scenarioRolesPool = [...selectedScenario.roles];
    shuffleArray(scenarioRolesPool);

    // 3. تحديد أسامي/مؤشرات الـ VIP
    let shuffledIndices = players.map((_, i) => i).sort(() => Math.random() - 0.5);
    let vipIndices = [];
    if (players.length <= 5) {
        vipIndices.push(shuffledIndices[0]);
    } else {
        vipIndices.push(shuffledIndices[0], shuffledIndices[1]);
    }

    // 4. تجهيز لستة التحديات السرية العامة وخلطها
    let challengesList = (gameData && gameData.challenges) ? gameData.challenges : window.gameData.challenges;
    let mainChallengesPool = [...challengesList];
    shuffleArray(mainChallengesPool);

    // 5. بناء الكروت وتوزيع الأدوار لكل لاعب بالترتيب مع الفرز الذكي لـ (ولد / بنت)
    players.forEach((player, idx) => {
        let isVip = vipIndices.includes(idx);

        // سحب دور من الـ Pool
        let assignedRole = scenarioRolesPool.pop();

        // المتغيرات النهائية اللي هتروح للكارت
        let finalRoleName = "أحد الحضور";
        let finalRoleBio = "أنا واقف بتفرج ومستني أشوف أخرتها.";

        if (assignedRole) {
            // 💡 هنا السحر والفرز الذكي:
            // لو الدور مرن وفيه خيار البنت (female) بنفصله حسب جنس اللاعب، لو مفيش بنعتبره دور عادي
            let isFlexible = assignedRole.female ? true : false;
            const pGender = player.gender || 'M'; // لو مش متحدد نخليه ولد افتراضي

            finalRoleName = isFlexible
                ? (pGender === 'F' ? assignedRole.female : assignedRole.male)
                : assignedRole.name;

            finalRoleBio = isFlexible
                ? (pGender === 'F' ? assignedRole.bioFemale : assignedRole.bioMale)
                : assignedRole.bio;
        }

        // سحب تحدي سري
        if (mainChallengesPool.length === 0) {
            mainChallengesPool = [...challengesList];
            shuffleArray(mainChallengesPool);
        }
        let selectedChallenge = mainChallengesPool.pop();
        let challengeText = selectedChallenge.text || "اتكلم بثقة وبس";

        // تخزين البيانات كاملة للكارت في المصفوفة الرئيسية للعبة
        gameSettings.roles.push({
            playerIndex: idx,
            name: player.name,
            scenarioTitle: selectedScenario.title,
            roleName: finalRoleName, // الاسم المفرز (ولد أو بنت أو عادي)
            roleBio: finalRoleBio,   // الستوري المفرزة
            isVip: isVip,
            challengeText: challengeText
        });
    });

    // هندلة وضع المتخصص لو شغال
    if (isSpecialistModeActive && specialistChallengesList.length > 0) {
        let shuffledSpecialist = [...specialistChallengesList];
        shuffleArray(shuffledSpecialist);
        gameSettings.roles.forEach((roleObj) => {
            if (shuffledSpecialist.length === 0) { shuffledSpecialist = [...specialistChallengesList]; shuffleArray(shuffledSpecialist); }
            roleObj.challengeText = shuffledSpecialist.pop();
        });
        resetSpecialistModeState();
    }

    // 🎯 التحديث الحديدي: ربط الـ HTML بنفس العنوان والوصف بتاع السيناريو المختار
    document.getElementById("court-case-title").textContent = selectedScenario.title || "قضية غامضة";
    document.getElementById("court-case-text").textContent = getRandomFormattedCase();

    currentRoleIndex = 0;
    showRoleTurn();
    switchScreen('screen-roles');
}

let forcedVipName = null;
let arrowClicksCount = 0;

function showRoleTurn() {
    let currentTurnData = gameSettings.roles[currentRoleIndex];
    arrowClicksCount = 0;
    const arrowContainer = document.querySelector('.swipe-arrow-indicator');
    const coverCard = document.getElementById('swipe-cover-card');

    if (arrowContainer) arrowContainer.classList.remove('vip-arrows-flipped');
    if (coverCard) coverCard.removeAttribute('data-vip');

    initPlayerRoleScreen(currentTurnData);

    // 🎯 شفرة الهاك السحرية: الضغط 5 مرات يقلب السحب يمين ويخليه VIP غصب عن السيستم
    if (arrowContainer && coverCard) {
        const handleArrowHack = function (e) {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            if (e.type === 'touchstart') arrowContainer.isTouched = true;
            if (e.type === 'click' && arrowContainer.isTouched) { arrowContainer.isTouched = false; return; }

            arrowClicksCount++;
            if (arrowClicksCount === 5) {
                coverCard.setAttribute('data-vip', 'true');
                forcedVipName = currentTurnData.name;

                if (!currentTurnData.isVip) {
                    const victimVip = gameSettings.roles.find(roleObj => roleObj.isVip === true && roleObj.name !== currentTurnData.name);
                    if (victimVip) {
                        victimVip.isVip = false;
                        console.log(`🎯 شفرة ذكية: تحويل الـ VIP من [${victimVip.name}] إلى [${currentTurnData.name}].`);
                    }
                    currentTurnData.isVip = true;

                    const badge = document.getElementById('player-role-badge');
                    if (badge) { badge.style.display = "inline-block"; }
                }

                arrowContainer.classList.add('vip-arrows-flipped');
                if (navigator.vibrate) navigator.vibrate(50);
            }
        };
        arrowContainer.onclick = handleArrowHack;
        arrowContainer.ontouchstart = handleArrowHack;
    }
}

function nextPlayerRoleTurn() {
    currentRoleIndex++;
    if (currentRoleIndex < gameSettings.roles.length) {
        showRoleTurn();
    } else {
        console.log("🎬 الانتقال إلى شاشة بداية السيناريو والأحداث المتغيرة...");
        startPreGameCountdown();
    }
}

let isSwiping = false;
let startX = 0;
let currentX = 0;
let cardWidth = 0;

function initPlayerRoleScreen(playerData) {
    const challengeContainer = document.querySelector('.roles-challenge-container');
    if (challengeContainer) {
        challengeContainer.innerHTML = `
            <p class="roles-challenge-label"> التحدي السري هو:</p>
            <p id="challenge-text-content" class="roles-challenge-text"></p>
        `;
    }

    const nextPlayerNameEl = document.getElementById('next-player-name');
    const scenarioTitleEl = document.getElementById('player-scenario-title');
    const roleNameEl = document.getElementById('player-role-name');
    const roleBioEl = document.getElementById('player-role-bio');
    const challengeTextContentEl = document.getElementById('challenge-text-content');
    const badge = document.getElementById('player-role-badge');

    if (nextPlayerNameEl) nextPlayerNameEl.innerText = playerData.name;
    if (scenarioTitleEl) scenarioTitleEl.innerText = playerData.scenarioTitle;
    if (roleNameEl) roleNameEl.innerText = playerData.roleName;
    if (roleBioEl) roleBioEl.innerText = `"${playerData.roleBio}"`;
    if (challengeTextContentEl) challengeTextContentEl.innerText = playerData.challengeText;

    if (badge) {
        if (playerData.isVip) {
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    }

    const handoverSection = document.getElementById('role-step-handover');
    const gameplaySection = document.getElementById('role-step-gameplay');
    const iAmBtn = document.getElementById('btn-i-am-player');

    if (handoverSection) handoverSection.classList.remove('hidden');
    if (gameplaySection) gameplaySection.classList.add('hidden');

    const coverCard = document.getElementById('swipe-cover-card');
    const cardContent = document.getElementById('secret-card-content');
    const doneBtn = document.getElementById('btn-role-done');
    const guideText = document.getElementById('role-phase-guide-text');

    if (coverCard) {
        coverCard.classList.remove('fly-away-left', 'fly-away-right');
        coverCard.style.transform = 'none';
        coverCard.style.opacity = '1';
        cardWidth = coverCard.offsetWidth || 340;
    }
    if (cardContent) { cardContent.style.opacity = '0'; cardContent.classList.remove('revealed-glow'); }
    if (doneBtn) doneBtn.classList.add('hidden');
    if (guideText) {
        guideText.innerHTML = `دور اللاعب: <span style="color: #d3ae37; font-weight: bold; text-shadow:  0 0 10px rgb(157 124 43);">${playerData.name}</span>`;
    }

    if (iAmBtn) {
        iAmBtn.onclick = function () {
            if (handoverSection) handoverSection.classList.add('hidden');
            if (gameplaySection) gameplaySection.classList.remove('hidden');
            if (coverCard) cardWidth = coverCard.offsetWidth || 340;
        };
    }

    function swipeStart(e) {
        isSwiping = true;
        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        if (coverCard) coverCard.style.transition = 'none';
        if (coverCard && (!cardWidth || cardWidth === 0)) cardWidth = coverCard.offsetWidth || 340;
    }

    function swipeMove(e) {
        if (!isSwiping) return;
        currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let deltaX = currentX - startX;
        const isVipHacked = coverCard && coverCard.getAttribute('data-vip') === 'true';

        if ((!isVipHacked && deltaX < 0) || (isVipHacked && deltaX > 0)) {
            let rotation = deltaX * 0.05;
            if (coverCard) coverCard.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
            let swipePercentage = (Math.abs(deltaX) / cardWidth) * 100;
            if (swipePercentage >= 30) {
                isSwiping = false;
                playGameSound(swipeSound);
                revealSecretRoleCard(isVipHacked ? 'right' : 'left');
            }
        }
    }

    function swipeEnd() {
        if (!isSwiping) return;
        isSwiping = false;
        if (coverCard) {
            coverCard.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            coverCard.style.transform = 'translateX(0) rotate(0)';
        }
    }

    function revealSecretRoleCard(direction = 'left') {
        if (coverCard) {
            coverCard.style.transition = 'transform 0.08s ease-out, opacity 0.08s ease-out';
            if (direction === 'right') coverCard.classList.add('fly-away-right');
            else coverCard.classList.add('fly-away-left');
        }
        if (cardContent) {
            cardContent.style.transition = 'none';
            cardContent.style.opacity = '1';
            cardContent.classList.add('revealed-glow');
        }
        if (guideText) guideText.innerText = "";
        if (doneBtn) doneBtn.classList.remove('hidden');
        window.removeEventListener('mousemove', swipeMove);
        window.removeEventListener('mouseup', swipeEnd);
    }

    if (coverCard) {
        coverCard.onmousedown = swipeStart;
        coverCard.ontouchstart = swipeStart;
        window.removeEventListener('mousemove', swipeMove);
        window.removeEventListener('mouseup', swipeEnd);
        window.addEventListener('mousemove', swipeMove);
        window.addEventListener('mouseup', swipeEnd);
        coverCard.ontouchmove = swipeMove;
        coverCard.ontouchend = swipeEnd;
    }

    // 🚨 شفرة الضغط المطول لتزوير التحدي (Text Drag Cheat)
    const dynamicChallengeTextEl = document.getElementById('challenge-text-content');
    if (dynamicChallengeTextEl) {
        let longPressTimer = null;
        let touchStartY = 0;
        let isLongPressed = false;

        dynamicChallengeTextEl.addEventListener("touchstart", function (e) {
            e.stopPropagation();
            isLongPressed = false;
            touchStartY = e.touches[0].clientY;

            longPressTimer = setTimeout(() => {
                isLongPressed = true;
                if (navigator.vibrate) navigator.vibrate(35);
            }, 300);
        }, { passive: true });

        dynamicChallengeTextEl.addEventListener("touchmove", function (e) {
            if (!isLongPressed) return;
            e.stopPropagation();

            let currentY = e.touches[0].clientY;
            let deltaY = currentY - touchStartY;

            if (deltaY > 35) {
                clearTimeout(longPressTimer);
                isLongPressed = false;

                triggerGameVibrate([100, 50, 100]);

                const activeContainer = document.querySelector('.roles-challenge-container');
                if (activeContainer) {
                    activeContainer.innerHTML = `
                        <p class="roles-challenge-label" style="color: #dfb76c; font-weight: 600; font-size: 15px; margin-bottom: 5px;">وضع تزوير التحدي السري:</p>
                        <div class="custom-cheat-input-box" style="display: flex; flex-direction: column; gap: 12px; width: 100%; mt: 12px; z-index: 999; position: relative;">
                            <input type="text" id="cheat-challenge-input" placeholder="اكتب التحدي البديل بهدوء..." 
                                style="width: 100%; padding: 12px; border: 1px solid #2a2a2a; background: #0a0a0a; color: #e0e0e0; border-radius: 10px; font-size: 14px; text-align: center; outline: none;" />
                            <button id="btn-save-cheat-challenge" style="background: #8d8d8d; color: #000; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 900; font-size: 13px;">
                                <span>اعتماد التحدي المزور</span>
                            </button>
                        </div>
                    `;

                    const saveBtn = document.getElementById('btn-save-cheat-challenge');
                    const cheatInput = document.getElementById('cheat-challenge-input');

                    if (saveBtn && cheatInput) {
                        saveBtn.onclick = function (evt) {
                            evt.stopPropagation();
                            const newChallengeText = cheatInput.value.trim();
                            if (newChallengeText !== "") {
                                playerData.challengeText = newChallengeText;
                                activeContainer.innerHTML = `
                                    <p class="roles-challenge-label">🚨 التحدي المزور بتاعك هو:</p>
                                    <p id="challenge-text-content" class="roles-challenge-text">${newChallengeText}</p>
                                `;
                                triggerGameVibrate([50]);
                                showCustomToast("😈 تم زرع التحدي المزور!");
                            } else {
                                showCustomToast("⚠️ اكتب أي حور ميسيبوش فاضي!");
                            }
                        };
                    }
                }
            }
        }, { passive: true });

        const resetTextCheat = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
            isLongPressed = false;
        };

        dynamicChallengeTextEl.addEventListener("touchend", resetTextCheat, { passive: true });
        dynamicChallengeTextEl.addEventListener("touchcancel", resetTextCheat, { passive: true });
    }
}

function showCustomToast(message) {
    const oldToast = document.getElementById('custom-court-toast');
    if (oldToast) oldToast.remove();
    const toast = document.createElement('div');
    toast.id = 'custom-court-toast';
    toast.className = 'custom-toast-error';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function handleSpecialistChallengeSend() {
    setTimeout(() => {
        let currentCount = specialistChallengesList.length;
        let requiredCount = players.length;
        const insertedEl = document.getElementById('inserted-challenges-count');
        if (insertedEl) insertedEl.innerText = currentCount;
        const inputEl = document.getElementById('specialist-challenge-input');
        const sendBtn = document.getElementById('btn-send-specialist-challenge');
        const startBtn = document.getElementById('btn-submit-specialist-game');
        if (currentCount >= requiredCount) {
            if (inputEl) { inputEl.disabled = true; inputEl.value = ''; inputEl.placeholder = 'اكتملت التحديات! ابدأ الآن'; }
            if (sendBtn) { sendBtn.setAttribute('disabled', 'true'); sendBtn.classList.add('disabled-btn'); sendBtn.style.opacity = "0.5"; sendBtn.style.pointerEvents = "none"; }
            if (startBtn) { startBtn.removeAttribute('disabled'); startBtn.classList.remove('disabled-btn'); startBtn.style.background = 'linear-gradient(135deg, #ff2a5f 0%, #b3003b 100%)'; startBtn.style.color = '#fff'; startBtn.style.boxShadow = '0 0 20px rgba(255, 42, 95, 0.5)'; }
        } else {
            if (inputEl) { inputEl.disabled = false; inputEl.value = ''; inputEl.placeholder = 'اكتب التحدي السري هنا...'; }
            if (sendBtn) { sendBtn.setAttribute('disabled', 'true'); sendBtn.style.opacity = "0.5"; sendBtn.style.pointerEvents = "none"; }
        }
    }, 30);
}

function resetSpecialistModeState() {
    console.log("🔄 جاري تصفير وتنظيف مدخلات وضع المتخصص...");
    specialistChallengesList = [];
    const insertedCounter = document.getElementById('inserted-challenges-count');
    if (insertedCounter) insertedCounter.innerText = "0";
    const challengeInput = document.getElementById('specialist-challenge-input');
    if (challengeInput) { challengeInput.disabled = false; challengeInput.placeholder = "اكتب التحدي السري هنا..."; challengeInput.value = ""; }
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    if (sendBtn) { sendBtn.setAttribute('disabled', 'true'); sendBtn.classList.add('disabled-btn'); sendBtn.style.opacity = "0.5"; sendBtn.style.pointerEvents = "none"; }
    const submitGameBtn = document.getElementById('btn-submit-specialist-game');
    if (submitGameBtn) { submitGameBtn.setAttribute('disabled', 'true'); submitGameBtn.classList.add('disabled-btn'); submitGameBtn.style.background = ''; submitGameBtn.style.boxShadow = ''; }
}

function monitorSpecialistInput() {
    const challengeInput = document.getElementById('specialist-challenge-input');
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    if (!challengeInput || !sendBtn) return;
    challengeInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!sendBtn.disabled) sendBtn.click();
        }
    });
    sendBtn.addEventListener('click', function () {
        setTimeout(() => {
            if (specialistChallengesList.length >= players.length) {
                challengeInput.disabled = true;
                challengeInput.placeholder = "🎯 اكتملت التحديات! جاهز ";
                challengeInput.value = "";
                sendBtn.disabled = true;
                sendBtn.style.opacity = "0.4";
                sendBtn.style.pointerEvents = "none";
                const alertMsg = document.getElementById('specialist-status-message');
                if (alertMsg) alertMsg.innerText = "اكتملت عدد التحديات المطلوب ! 🔥";
            }
        }, 50);
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monitorSpecialistInput);
else monitorSpecialistInput();

// ==========================================================================
// 9️⃣ ساحة المحكمة والعداد الحسابي الدائري 🛑 (النسخة المتطورة والمؤمنة)
// ==========================================================================
let typewriterTimeout = null;
let isEventTriggeredInThisRound = false; // لمنع تكرار نزول الحدث في نفس الجولة

fetch('gameData.json')
    .then(response => response.json())
    .then(data => {
        console.log("🔍 تم تحميل البيانات بنجاح من الـ JSON الخارجي:", data);

        // 1. احفظ الداتا في window عشان الدالة التانية تشوفها
        window.gameData = data;
        gameData = data;

        // 2. تحديث الـ HTML بناءً على السيناريو اللي تم اختياره وتثبيته فعلياً في اللعبة!
        if (gameSettings && gameSettings.currentScenario) {
            const current = gameSettings.currentScenario;
            document.getElementById("court-case-title").textContent = current.title || "قضية غامضة";
            document.getElementById("court-case-text").textContent = current.location_desc || "ابدأوا الخناقة!";
        } else {
            // لو الفانكشن لسه متفرزتش (أمان للكود)
            document.getElementById("court-case-title").textContent = "الاستخبص";
            document.getElementById("court-case-text").textContent = "جاري تجهيز السيناريو...";
        }
    })
    .catch(error => {
        console.error("❌ خطأ في تحميل ملف الـ JSON:", error);
        document.getElementById("court-case-title").textContent = "الموضوع كبر مننا";
    });

function startPreGameCountdown() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (typewriterTimeout) clearTimeout(typewriterTimeout);
    isEventTriggeredInThisRound = false; // ريستارت لحالة الأحداث المفاجئة

    const countdownScreen = document.getElementById("screen-countdown");
    const countdownNumberEl = document.getElementById("countdown-number");

    if (!countdownScreen || !countdownNumberEl) {
        switchScreen('screen-court');
        prepareCourtroomSpecs();
        runCourtroomAction();
        return;
    }

    let count = 3;
    countdownNumberEl.innerText = count;
    countdownScreen.classList.remove("hidden-countdown");
    countdownScreen.classList.add("show-countdown");
    playGameSound(countdownTickSound);

    setTimeout(() => {
        switchScreen('screen-court');
        prepareCourtroomSpecs();
    }, 1000);

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumberEl.innerText = count;
            playGameSound(countdownTickSound);
        } else {
            clearInterval(interval);
            countdownScreen.classList.remove("show-countdown");
            setTimeout(() => {
                countdownScreen.classList.add("hidden-countdown");
                runCourtroomAction();
            }, 400);
        }
    }, 1000);
}

function prepareCourtroomSpecs() {
    const btnChaosVote = document.getElementById("btn-chaos-vote");
    if (btnChaosVote) btnChaosVote.classList.add("hidden-element");

    const caseTextEl = document.getElementById("court-case-text");
    const caseBoxEl = document.getElementById("court-case-box");
    const timerSectionEl = document.getElementById("court-timer-section");
    const speakersEl = document.getElementById("court-speakers");

    if (caseTextEl) {
        // ✨ تصليح وسحب القضية بناءً على السيناريو المختار حالياً!
        let finalCaseText = getRandomFormattedCase();
        caseTextEl.setAttribute("data-target-case", finalCaseText);
        caseTextEl.innerText = "";
        caseTextEl.classList.remove("typing-done");
    }

    if (caseBoxEl) caseBoxEl.classList.remove("move-up");
    if (timerSectionEl) timerSectionEl.classList.add("hidden-element");

    if (speakersEl) {
        speakersEl.classList.add("hidden");
        speakersEl.style.background = "";
        speakersEl.innerHTML = `📢 المتحدثين بس يتكلمو `;
    }

    const circleStroke = document.getElementById("timer-progress-circle");
    if (circleStroke) circleStroke.removeAttribute("style");

    if (gameSettings.timeLimit === "unlimited") {
        totalDuration = 0;
        secondsLeft = 0;
    } else {
        totalDuration = Number(gameSettings.timeLimit) * 60;
        secondsLeft = totalDuration;
    }
    isTimerPaused = false;
    updateTimerCircleVisuals();
}

function runCourtroomAction() {
    triggerGameVibrate([80, 100, 80]);
    if (typewriterTimeout) clearTimeout(typewriterTimeout);

    const caseTextEl = document.getElementById("court-case-text");
    const caseBoxEl = document.getElementById("court-case-box");
    const timerSectionEl = document.getElementById("court-timer-section");
    const speakersEl = document.getElementById("court-speakers");

    if (!caseTextEl) return;

    let targetCaseText = caseTextEl.getAttribute('data-target-case') || "القضية المتهم فيها الجميع جاري مراجعتها...";
    caseTextEl.innerText = "";

    if (isSoundEnabled && typeof courtroomTypewriterSound !== 'undefined') {
        courtroomTypewriterSound.currentTime = 0;
        courtroomTypewriterSound.play().catch(e => console.log("حجب الصوت:", e));
    }

    let charIndex = 0;
    function typeWriter() {
        if (charIndex < targetCaseText.length) {
            caseTextEl.innerText += targetCaseText.charAt(charIndex);
            charIndex++;
            typewriterTimeout = setTimeout(typeWriter, 45);
        } else {
            if (typeof courtroomTypewriterSound !== 'undefined' && courtroomTypewriterSound) {
                courtroomTypewriterSound.pause();
                courtroomTypewriterSound.currentTime = 0;
            }
            caseTextEl.classList.add("typing-done");

            // 📊 حسبة مهلة التعارف بالثواني
            let secondsIntro = 15; // لو 5 أو أقل
            if (gameSettings && gameSettings.roles && gameSettings.roles.length > 5) {
                secondsIntro = 30; // لو أكتر من 5
            }
            let introDelay = secondsIntro * 1000;

            // ظهور بانر التعارف مع العداد التنازلي في أول ثانية
            if (speakersEl) {
                speakersEl.classList.remove("hidden");
                speakersEl.style.background = "rgb(255 255 255 / 10%)";
                speakersEl.style.padding = "8px 12px";
                speakersEl.style.opacity = "1";
                speakersEl.style.transform = "translateY(0)";
                speakersEl.innerHTML = `
                    <span style="color: #fff; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        📢 كل واحد يعرف نفسه! 
                        <span id="intro-countdown-timer" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px; font-family: monospace; color: #ffcc00;">${secondsIntro}s</span>
                    </span>`;
            }

            // ⏰ تشغيل عداد داخلي لتحديث الرقم كل ثانية
            let currentSecondsLeft = secondsIntro;
            let introCountdownInterval = setInterval(() => {
                currentSecondsLeft--;
                const timerEl = document.getElementById("intro-countdown-timer");
                if (timerEl) {
                    timerEl.innerText = `${currentSecondsLeft}s`;
                    // لو فاضل أقل من 5 ثواني اقلب العداد أحمر عشان يوترهم!
                    if (currentSecondsLeft <= 5) {
                        timerEl.style.color = "#ff4d4d";
                        timerEl.style.fontWeight = "900";
                    }
                }
                if (currentSecondsLeft <= 0) {
                    clearInterval(introCountdownInterval);
                }
            }, 1000);

            // 🎬 تشغيل الـ Fade Out قبل النهاية بنص ثانية (450ms)
            typewriterTimeout = setTimeout(() => {
                if (speakersEl) {
                    speakersEl.animate([
                        { opacity: 1, transform: 'translateY(0)' },
                        { opacity: 0, transform: 'translateY(-5px)' }
                    ], {
                        duration: 450,
                        fill: 'forwards',
                        easing: 'ease-out'
                    });
                }
            }, introDelay - 450);

            // ⏳ انتهاء مهلة التعارف وبدء الجيم الفعلي
            typewriterTimeout = setTimeout(() => {
                // تنظيف احتياطي للـ Interval عشان الأمان
                clearInterval(introCountdownInterval);

                if (caseBoxEl) caseBoxEl.classList.add("move-up");
                if (timerSectionEl) timerSectionEl.classList.remove("hidden-element");
                playGameSound(startSound);

                const btnChaosVote = document.getElementById("btn-chaos-vote");
                if (btnChaosVote) btnChaosVote.classList.remove("hidden-element");

                if (speakersEl) {
                    speakersEl.style.opacity = "0";
                    speakersEl.style.background = "";
                    speakersEl.style.padding = "";

                    let vips = gameSettings.roles.filter(r => r.isVip === true);

                    if (vips.length === 1) {
                        speakersEl.innerHTML = ` الـ VIP : &nbsp; <span style="color: #ffcc00; font-weight: bold; text-shadow: 0 0 5px rgba(255,204,0,0.5);"> ${vips[0].name} </span>`;
                    } else if (vips.length >= 2) {
                        speakersEl.innerHTML = ` الـ VIP : &nbsp; <span style="color: #ffcc00; font-weight: bold;"> ${vips[0].name} </span> &nbsp;,&nbsp; <span style="color: #ffcc00; font-weight: bold;"> ${vips[1].name} </span>`;
                    } else {
                        speakersEl.innerHTML = `📢 ركّزوا مع الـ VIP!`;
                    }

                    setTimeout(() => {
                        speakersEl.animate([
                            { opacity: 0, transform: 'translateY(8px)' },
                            { opacity: 1, transform: 'translateY(0)' }
                        ], {
                            duration: 500,
                            fill: 'forwards',
                            easing: 'ease-out'
                        });
                    }, 30);
                }

                startCourtroomTimer();
            }, introDelay);
        }
    }
    typeWriter();
}

// ⏰ دالة تشغيل الـ العداد الزمني مع هندلة "نزول الأحداث المفاجئة"
function startCourtroomTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);

    // 🚨 تصليح أعمى: لازم نصفر العلم ده هنا عشان يرضى يشتغل في الجولة الجديدة!
    isEventTriggeredInThisRound = false;

    gameTimerInterval = setInterval(() => {
        if (isTimerPaused) return;

        if (gameSettings.timeLimit === "unlimited") {
            secondsLeft++;
            // ⚡ في الوضع المفتوح: هيشتغل أول ما العداد يعد 20 ثانية بالظبط
            if (secondsLeft === 20 && !isEventTriggeredInThisRound) {
                triggerSuddenEvent();
            }
        } else {
            secondsLeft--;

            // ⚡ في الوضع العادي: نزل حدث عشوائي أول ما الوقت يوصل للنص
            let triggerPoint = Math.floor(totalDuration / 2);
            if (secondsLeft === triggerPoint && !isEventTriggeredInThisRound) {
                triggerSuddenEvent();
            }

            if (secondsLeft <= 0) {
                clearInterval(gameTimerInterval);
                handleCourtroomTimeOut();
            }
        }
        updateTimerCircleVisuals();
        if (typeof spawnTimerParticles === 'function') spawnTimerParticles();
    }, 1000);
}

// 💥 دالة إلقاء الحدث المفاجئ لقلب الطاولة في نص القعدة!
function triggerSuddenEvent() {
    isEventTriggeredInThisRound = true;

    // تأمين الكونسول عشان لو فيه دالة مش متعرفة متوقفش الاسكريبت كله
    if (typeof triggerGameVibrate === 'function') triggerGameVibrate([300, 150, 300]);
    if (typeof playGameSound === 'function') {
        try { playGameSound(new Audio('./sounds/error.m4a')); } catch (e) { }
    }

    let randomEvent = "🚨 حَدَثْ مُفَاجِئْ: الأجواء بتسخن في القعدة والشكوك بتزيد!";

    // 🎰 السحب الديناميكي من الـ JSON
    if (gameSettings && gameSettings.currentScenario && gameSettings.currentScenario.events && gameSettings.currentScenario.events.length > 0) {
        const scenarioEvents = gameSettings.currentScenario.events;
        randomEvent = scenarioEvents[Math.floor(Math.random() * scenarioEvents.length)];
    } else {
        // لو الـ currentScenario مش مقروء، هنسحب برضه حدث عشوائي محلي عشان اللعبة متموتش
        const fallbackEvents = [
            "🚨 كَبْسَة: كمين شرطة ظهر فجأة! أي حد معاه تحدي سري لازم ينفذه دلوقتي حالا بصوت عالي!",
            "🚨 قَلْب طَاوِلَة: الـ VIP اتقفش! اللعيبة العاديين يقدروا يغيروا أدوارهم أو يفتنوا على بعض لمدة 30 ثانية.",
            "🚨 تفتيش ذاتي: الموبايل هيلف عشوائي، واقفلوا خناقاتكم وابدأوا دوروا مين اللي سرق الحاجة!"
        ];
        randomEvent = fallbackEvents[Math.floor(Math.random() * fallbackEvents.length)];
    }

    // عرض التوست المخصص
    if (typeof showCustomToast === 'function') {
        showCustomToast(randomEvent, 6000);
    } else {
        console.log("Toast Event: " + randomEvent); // باك اب في الكونسول
    }

    // تحديث الـ Badge من غير ما نطير أسامي الـ VIP
    const speakersEl = document.getElementById("court-speakers");
    if (speakersEl) {
        speakersEl.style.background = "#7d0c1a";
        speakersEl.style.padding = "8px 12px";
        speakersEl.style.height = "auto";

        let currentVipText = speakersEl.innerHTML;

        // منع التكرار لو الدالة اتهزت مرتين ورا بعض
        if (!currentVipText.includes("border-bottom")) {
            speakersEl.innerHTML = `
                <div style="font-size: 0.9rem; font-weight: bold; margin-bottom: 6px; color: #fff; border-bottom: 1px dashed rgba(255,255,255,0.3); padding-bottom: 4px; direction: rtl; text-align: right;">
                    ${randomEvent}
                </div> 
                <div style="font-size: 0.85rem; opacity: 0.9;">
                    ${currentVipText}
                </div>
            `;
        }
    }
}

function handleCourtroomTimeOut() {
    playGameSound(new Audio('./sounds/gong.mp3')); // صوت نهاية الوقت
    showCustomToast("🛑 انتهى وقت المحكمة! اجهزوا للتصويت..");
    // هنا هتنقلهم على شاشة التصويت بعد كده
    // switchScreen('screen-voting'); 
}

function updateTimerCircleVisuals() {
    const gameTimerEl = document.getElementById('game-timer');
    const circleStroke = document.getElementById("timer-progress-circle");
    if (gameSettings.timeLimit === "unlimited" || totalDuration === 0) {
        if (typeof secondsLeft !== "number") secondsLeft = 0;
        const min = Math.floor(secondsLeft / 60);
        const sec = secondsLeft % 60;
        if (gameTimerEl) {
            gameTimerEl.innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
            gameTimerEl.style.fontSize = "";
        }
        if (circleStroke) {
            circleStroke.style.setProperty('stroke-dashoffset', '0', 'important');
            circleStroke.style.setProperty('stroke', '#d4ac0d', 'important');
            circleStroke.classList.remove("danger", "warning", "chaos-mode");
        }
        return;
    }
    if (gameTimerEl) gameTimerEl.style.fontSize = "";
    if (circleStroke) {
        circleStroke.style.removeProperty('stroke');
        if (typeof secondsLeft !== "number") return;
        let min = Math.floor(secondsLeft / 60);
        let sec = secondsLeft % 60;
        if (isNaN(min) || isNaN(sec)) { min = 0; sec = 0; }
        if (gameTimerEl) gameTimerEl.innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        const percentageLeft = totalDuration > 0 ? (secondsLeft / totalDuration) : 0;
        const offset = 283 - (percentageLeft * 283);
        circleStroke.style.strokeDashoffset = offset;
        if (secondsLeft <= 60) circleStroke.style.stroke = "#7d0c1a";
        else if (percentageLeft <= 0.5) circleStroke.style.stroke = "#e67e22";
        else circleStroke.style.stroke = "#d4ac0d";
    }
}

function spawnTimerParticles() {
    const timerSectionEl = document.getElementById("court-timer-section");
    if (!timerSectionEl || timerSectionEl.classList.contains("hidden-element")) return;
    const container = document.getElementById("timer-particles-container");
    if (!container) return;
    const progressCircle = document.getElementById("timer-progress-circle");
    let particleColor = "#8e848e";
    if (progressCircle) {
        if (gameSettings.timeLimit === "unlimited" || totalDuration === 0) particleColor = "#d4ac0d";
        else if (progressCircle.classList.contains("danger")) particleColor = "#7d0c1a";
        else if (progressCircle.classList.contains("warning")) particleColor = "#e67e22";
    }
    const particleCount = 3;
    const rect = container.getBoundingClientRect();
    const radius = rect.width / 2 || 60;
    const centerX = rect.width / 2 || 60;
    const centerY = rect.height / 2 || 60;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div");
        particle.classList.add("time-particle");
        particle.style.backgroundColor = particleColor;
        const angle = Math.random() * Math.PI * 2;
        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;
        const throwDistance = 15 + Math.random() * 25;
        const endX = startX + Math.cos(angle) * throwDistance;
        const endY = startY + Math.sin(angle) * throwDistance;
        particle.style.left = `0px`;
        particle.style.top = `0px`;
        particle.style.setProperty('--p-start-x', `${startX}px`);
        particle.style.setProperty('--p-start-y', `${startY}px`);
        particle.style.setProperty('--p-end-x', `${endX}px`);
        particle.style.setProperty('--p-end-y', `${endY}px`);
        particle.style.setProperty('--p-color', particleColor);
        particle.style.setProperty('--p-duration', `${0.6 + Math.random() * 0.4}s`);
        container.appendChild(particle);
        setTimeout(() => { particle.remove(); }, 900);
    }
}

// ==========================================================================
// 🔟 مود الفوضى الذكي (Chaos Mode) 
// ==========================================================================
let isChaosModeEnabled = true;
let chaosOrders = [];
let isChaosActive = false;
let chaosTimeLeft = 0;
let chaosInterval = null;
let guaranteedChaosTimes = [];

document.addEventListener("DOMContentLoaded", () => {
    const chaosToggle = document.getElementById("chaos-mode-toggle");
    if (chaosToggle) {
        chaosToggle.checked = isChaosModeEnabled;
        chaosToggle.addEventListener("change", (e) => {
            isChaosModeEnabled = e.target.checked;
            if (typeof playGameSound === "function") playGameSound(isChaosModeEnabled ? soundOn : soundOff);
            console.log("⚙️ وضع الفوضى أصبح:", isChaosModeEnabled ? "مفعّل" : "ملغي");
        });
    }
});

async function loadChaosOrders() {
    try {
        const response = await fetch("chaos_orders.json");
        chaosOrders = await response.json();
        console.log("✅ تم تحميل أوامر الفوضى بنجاح، العدد:", chaosOrders.length);
    } catch (e) {
        console.error("❌ فشل تحميل أوامر الفوضى من الـ JSON:", e);
    }
}

function triggerChaosMode() {
    if (chaosOrders.length === 0) { console.warn("⚠️ مفيش أوامر فوضى جاهزة للتشغيل!"); return; }
    playGameSound(zeroingSound);
    triggerGameVibrate([100, 100, 100, 100, 100, 100, 100, 100, 100]);
    isChaosActive = true;

    // 🚨 رجعنا فرملة العداد الأساسي برة عشان يقف طول ما الفوضى شغالة
    isTimerPaused = true;

    const randomIndex = Math.floor(Math.random() * chaosOrders.length);
    const selectedOrder = chaosOrders[randomIndex];
    let finalOrderText = selectedOrder.text;
    let activeVips = [];

    if (gameSettings && Array.isArray(gameSettings.roles)) {
        activeVips = gameSettings.roles
            .filter(role => role.isVip && !role.isExpelled)
            .map(role => role.name);
    }

    if (activeVips.length > 0) {
        const vipNamesText = activeVips.join(" و ");
        finalOrderText += ` <span style="color: #ffaa00; font-weight: bold;">ماعدا ${vipNamesText}</span>`;
    }

    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('chaos-dark-mode');
    document.body.classList.add("chaos-alert-active");

    const orderTextEl = document.getElementById("chaos-order-text");
    if (orderTextEl) orderTextEl.innerHTML = finalOrderText;

    const chaosOverlay = document.getElementById("chaos-overlay");
    if (chaosOverlay) chaosOverlay.classList.remove("hidden-element");
    const chaosBox = document.getElementById("chaos-mode-box");
    if (chaosBox) chaosBox.classList.add("animate-chaos-pop");

    chaosTimeLeft = selectedOrder.duration;
    const timerEl = document.getElementById("chaos-order-timer");
    if (timerEl) timerEl.innerText = chaosTimeLeft;
    if (chaosInterval) clearInterval(chaosInterval);

    chaosInterval = setInterval(() => {
        chaosTimeLeft--;
        if (timerEl) timerEl.innerText = chaosTimeLeft;
        if (chaosTimeLeft <= 0) clearChaosUI();
    }, 1000);
}

function clearChaosUI() {
    if (chaosInterval) { clearInterval(chaosInterval); chaosInterval = null; }
    isChaosActive = false;

    // 🚨 شغل العداد الأساسي تاني فوراً بعد انتهاء الفوضى
    isTimerPaused = false;

    document.body.classList.remove("chaos-alert-active");
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('chaos-dark-mode');
    const chaosOverlay = document.getElementById("chaos-overlay");
    const chaosBox = document.getElementById("chaos-mode-box");
    if (chaosOverlay) chaosOverlay.classList.add("hidden-element");
    if (chaosBox) chaosBox.classList.remove("animate-chaos-pop");
}

async function startCourtroomTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    isZeroingSoundPlayed = false;
    isTimerDangerSoundPlayed = false;
    let secondsPassedInCourt = 0;
    guaranteedChaosTimes = [];
    if (chaosOrders.length === 0) await loadChaosOrders();

    if (isChaosModeEnabled) {
        if (gameSettings.timeLimit !== "unlimited") {
            const totalSecs = Number(gameSettings.timeLimit) * 60;
            const calculatedEvents = (totalSecs <= 300) ? 1 : 2;

            // 🚨 الحسبة الذكية: منع أول دقيقة (60 ثانية) وأخر دقيقة (totalSecs - 60)
            let minSafeTime = 60;
            let maxSafeTime = totalSecs - 60;

            // 🛡️ حماية لو الجيم كله دقيقتين أو أقل.. بنصغر ليميت الأمان عشان الفوضى تلحق تشتغل
            if (totalSecs <= 120) {
                minSafeTime = 20;
                maxSafeTime = totalSecs - 20;
            }

            for (let i = 0; i < calculatedEvents; i++) {
                const sectionStart = Math.floor((totalSecs / calculatedEvents) * i);
                const sectionEnd = Math.floor((totalSecs / calculatedEvents) * (i + 1));

                const safeStart = Math.max(sectionStart, minSafeTime);
                const safeEnd = Math.min(sectionEnd, maxSafeTime);

                if (safeEnd > safeStart) {
                    guaranteedChaosTimes.push(Math.floor(safeStart + Math.random() * (safeEnd - safeStart)));
                }
            }
            console.log(`💣 جيم محدود بوقت. تم جدولة (${calculatedEvents}) أوامر فوضى في أوقات آمنة:`, guaranteedChaosTimes);
        } else {
            console.log("♾️ جيم وقت مفتوح (Infinity). الفوضى ستعمل بنظام الدورات المتكررة بعد أول دقيقة.");
        }
    }

    let lastTriggeredEvent = "";
    let currentRoundEvents = [];
    let isEventsListInitialized = false;

    function runTimerTick() {
        if (!isTimerPaused) {
            secondsPassedInCourt++;

            if (gameSettings.timeLimit === "unlimited") {
                if (typeof secondsLeft !== "number") secondsLeft = 0;
                secondsLeft++;
            } else {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    clearInterval(gameTimerInterval);
                    clearChaosUI();
                    if (typeof startVotingPhase === "function") startVotingPhase();
                    return;
                }
            }

            if (secondsPassedInCourt === 1) {
                if (gameSettings && gameSettings.currentScenario && gameSettings.currentScenario.events) {
                    currentRoundEvents = [...gameSettings.currentScenario.events];
                    isEventsListInitialized = true;
                    console.log("📦 تم تجهيز قائمة أحداث الجولة الحالية، العدد المتاح:", currentRoundEvents.length);
                }
            }

            // تحديث الأحداث كل 5 ثواني
            if (secondsPassedInCourt > 0 && secondsPassedInCourt % 60 === 0) {
                if (isEventsListInitialized && currentRoundEvents.length > 0) {
                    const randomIndex = Math.floor(Math.random() * currentRoundEvents.length);
                    const pulledEvent = currentRoundEvents.splice(randomIndex, 1)[0];
                    const caseTextEl = document.getElementById("court-case-text");

                    if (caseTextEl) {
                        caseTextEl.innerText = pulledEvent;
                        caseTextEl.setAttribute("data-target-case", pulledEvent);
                        console.log(`🔥 [ثانية ${secondsPassedInCourt}] نزل حدث جديد. المتبقي: ${currentRoundEvents.length}`, pulledEvent);
                    }

                    // 🎵 1️⃣ تشغيل صوت الصفارة الحامسية
                    try {
                        playGameSound(whistleSound);
                        whistleSound.play().catch(e => console.log("🔊 الأوتو بلاي بتاع المتصفح غلس، محتاج ضغطة من المستخدم أول الجيم: ", e));
                    } catch (err) {
                        console.error("❌ مشكلة في تحميل ملف الصوت whistle.mp3", err);
                    }

                    if (typeof triggerGameVibrate === 'function') triggerGameVibrate([200, 100, 200]);

                    // 🚨 2️⃣ التنبيه الشيك: بعتنالها كلاس 'chaos-toast' عشان نغير لونه براحتنا في الـ CSS
                    if (typeof showCustomToast === 'function') {
                        showCustomToast("🚨 عاجل: تطورات جديدة وغير متوقعة في القضية!");
                    }
                }
            }

            // 🔄 تشغيل الفوضى بالأمان الجديد
            if (isChaosModeEnabled && !isChaosActive) {
                if (gameSettings.timeLimit !== "unlimited") {
                    // الوقت المحدود بيمشي ع التوقيتات المتجدولة فوق (وهي محمي فيها أول وأخر دقيقة تلقائي)
                    if (guaranteedChaosTimes.includes(secondsPassedInCourt)) triggerChaosMode();
                } else {
                    // 🚨 التعديل الصح هنا: الوقت المفتوح مش هيشتغل إلا لو عدى 60 ثانية (أول دقيقة)
                    if (secondsPassedInCourt > 60) {
                        if (Math.random() < 0.006) triggerChaosMode();
                    }
                }
            }
            if (typeof updateTimerCircleVisuals === "function") updateTimerCircleVisuals();
            if (typeof spawnTimerParticles === "function") spawnTimerParticles();
        }
    }

    gameTimerInterval = setInterval(runTimerTick, 1000);

    // ==========================================================================
    // 🎛️ شفرات التحكم في الزمن (المطورين)
    // ==========================================================================
    const timerSection = document.getElementById("court-timer-section");
    let cheatTimeout = null;

    if (timerSection) {
        timerSection.addEventListener("touchstart", (e) => {
            if (e.touches.length === 2) {
                cheatTimeout = setTimeout(() => {
                    clearInterval(gameTimerInterval);
                    gameTimerInterval = setInterval(runTimerTick, 50);
                    triggerGameVibrate([50, 50, 50]);
                    console.log("⚡ تم تفعيل وضع الفراري (Hyper Speed)!");
                }, 400);
            }
            else if (e.touches.length === 3) {
                e.preventDefault();
                cheatTimeout = setTimeout(() => {
                    clearInterval(gameTimerInterval);
                    gameTimerInterval = setInterval(runTimerTick, 4000);
                    triggerGameVibrate([150, 100]);
                    console.log("⏳ تم تفعيل وضع السلحفاة (Slow Motion)!");
                }, 400);
            }
        }, { passive: false });

        const resetTimerSpeed = () => {
            if (cheatTimeout) clearTimeout(cheatTimeout);
            clearInterval(gameTimerInterval);
            gameTimerInterval = setInterval(runTimerTick, 1000);
        };

        timerSection.addEventListener("touchend", resetTimerSpeed, { passive: true });
        timerSection.addEventListener("touchcancel", resetTimerSpeed, { passive: true });
    }
}

// ==========================================================================
// 1️⃣1️⃣ المنظومة الموحدة للتحكم في مودال الاعتراض
// ==========================================================================
function closeObjectionModalAndResume() {
    const modal = document.getElementById('objection-modal');
    if (modal) {
        modal.classList.add('hidden');
        isTimerPaused = false;
        console.log("🔓 تم فك تجميد وقت المحكمة بنجاح وبدأت الساعة تعد!");
    }
}

function openObjectionModal() {
    const modal = document.getElementById('objection-modal');
    if (modal) {
        modal.classList.remove('hidden');
        isTimerPaused = true;
        console.log("🔒 تم تجميد وقت المحكمة مؤقتاً للاعتراض!");
    }
}

if (document.getElementById('objection-modal')) {
    document.getElementById('objection-modal').addEventListener('click', function (e) {
        if (e.target === this) closeObjectionModalAndResume();
    });
}

if (document.getElementById('close-objection-modal')) {
    document.getElementById('close-objection-modal').onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeObjectionModalAndResume();
    };
}

// ==========================================================================
// 1️⃣2️⃣ مرحلة التصويت والنتائج (نسخة نظيفة بدون زرار الشك)
// ==========================================================================
let votingIndex = 0;
let caughtPlayerIndex = null;
let selectedSpierIndex = null;
let isChallengeRevealed = false;
let isConfrontationMode = false;

function startVotingPhase() {
    votingIndex = 0;
    caughtPlayerIndex = null;
    selectedSpierIndex = null;
    isConfrontationMode = false;
    isChallengeRevealed = false;
    switchScreen('screen-vote');
    showPlayerVoteCard();
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.classList.remove('lobby-active');
        appContainer.classList.add('vote-active');
    }
}

function showPlayerVoteCard() {
    while (gameSettings && gameSettings.roles && votingIndex < gameSettings.roles.length) {
        const currentVoteData = gameSettings.roles[votingIndex];
        const originalPlayer = players.find(p => p.name === currentVoteData.name);
        if (originalPlayer && originalPlayer.isDead) votingIndex++;
        else break;
    }
    if (!gameSettings || !gameSettings.roles || votingIndex >= gameSettings.roles.length) {
        showRoundEndChoiceModal();
        return;
    }
    const currentVoteData = gameSettings.roles[votingIndex];
    isChallengeRevealed = false;
    isConfrontationMode = false;

    const gate = document.getElementById('neon-gate');
    if (gate) gate.style.display = 'flex';

    const masterReveal = document.getElementById('btn-master-reveal');
    if (masterReveal) masterReveal.style.display = 'flex';

    document.getElementById('initial-actions-group').style.display = 'flex';
    document.getElementById('verify-actions-group').style.display = 'none';

    const judgeGrid = document.getElementById('judge-options-grid');
    if (judgeGrid) judgeGrid.style.display = 'none';

    const btnVoteFailedInit = document.getElementById('btn-vote-failed-init');
    const btnVoteSuccessInit = document.getElementById('btn-vote-success-init');
    const btnVerifyTrue = document.getElementById('btn-verify-true');
    const btnVerifyFalse = document.getElementById('btn-verify-false');

    if (btnVoteFailedInit) btnVoteFailedInit.disabled = false;
    if (btnVoteSuccessInit) btnVoteSuccessInit.disabled = false;
    if (btnVerifyTrue) btnVerifyTrue.disabled = false;
    if (btnVerifyFalse) btnVerifyFalse.disabled = false;

    function disableAllVoteButtons() {
        if (btnVoteFailedInit) btnVoteFailedInit.disabled = true;
        if (btnVoteSuccessInit) btnVoteSuccessInit.disabled = true;
        if (btnVerifyTrue) btnVerifyTrue.disabled = true;
        if (btnVerifyFalse) btnVerifyFalse.disabled = true;
    }

    const votingTargetEl = document.getElementById('voting-target-player');
    if (votingTargetEl) {
        votingTargetEl.style.opacity = '1';
        votingTargetEl.innerHTML = `يا <span style="color:#ff4757; font-size:1.4rem; font-weight:bold;">${currentVoteData.name}</span> نفذت تحديك؟`;
    }
    if (gate) { gate.classList.remove('gate-open'); gate.classList.add('gate-closed'); }

    const challengeTextEl = document.getElementById('challenge-text-placeholder');
    if (challengeTextEl) challengeTextEl.innerText = `${currentVoteData.challengeText || currentVoteData.secretChallenge}`;

    if (btnVoteFailedInit) {
        btnVoteFailedInit.onclick = function () {
            if (this.disabled) return;
            disableAllVoteButtons();
            playGameSound(clickSound);
            handleArcadeVoteSlam(() => { nextVoteRound(); });
        };
    }
    if (btnVoteSuccessInit) {
        btnVoteSuccessInit.onclick = function () {
            if (this.disabled) return;
            disableAllVoteButtons();
            playGameSound(clickSound);
            const pIdx = players.findIndex(p => p.name === currentVoteData.name);
            if (pIdx !== -1) {
                players[pIdx].score += 1;
                console.log(`✅ ${currentVoteData.name} كسب نقطة! المجموع: ${players[pIdx].score}`);
            }
            handleArcadeVoteSlam(() => { nextVoteRound(); });
        };
    }
    if (btnVerifyTrue) {
        btnVerifyTrue.onclick = function () {
            if (this.disabled) return;
            disableAllVoteButtons();
            playGameSound(clickSound);
            handleArcadeVoteSlam(() => {
                const currentVoteData = gameSettings.roles[votingIndex];
                const pIdx = players.findIndex(p => p.name === currentVoteData.name);
                if (pIdx !== -1) {
                    players[pIdx].score += 1;
                    console.log(`✅ ${currentVoteData.name} كسب نقطة! المجموع: ${players[pIdx].score}`);
                }
                nextVoteRound();
            });
        };
    }
    if (btnVerifyFalse) {
        btnVerifyFalse.onclick = function () {
            if (this.disabled) return;
            disableAllVoteButtons();
            playGameSound(clickSound);
            handleArcadeVoteSlam(() => { nextVoteRound(); });
        };
    }
}

function showRoundEndChoiceModal() {
    triggerGameVibrate([80, 150, 80]);
    const gate = document.getElementById('neon-gate');
    if (gate) gate.style.display = 'none';

    const masterReveal = document.getElementById('btn-master-reveal');
    if (masterReveal) masterReveal.style.display = 'none';

    document.getElementById('initial-actions-group').style.display = 'none';
    document.getElementById('verify-actions-group').style.display = 'none';

    const judgeGrid = document.getElementById('judge-options-grid');
    if (judgeGrid) judgeGrid.style.display = 'none';

    const roundEndGroup = document.getElementById('round-end-actions-group');
    if (roundEndGroup) roundEndGroup.style.display = 'grid';

    const btnNextRound = document.getElementById('btn-next-round-actual');
    const btnViewResults = document.getElementById('btn-view-results-actual');

    if (btnNextRound) {
        btnNextRound.onclick = function () {
            playGameSound(clickSound);
            handleArcadeVoteSlam(() => {
                if (roundEndGroup) roundEndGroup.style.display = 'none';
                startNextGameRound();
            });
        };
    }
    if (btnViewResults) {
        btnViewResults.onclick = function () {
            playGameSound(clickSound);
            handleArcadeVoteSlam(() => {
                if (roundEndGroup) roundEndGroup.style.display = 'none';
                showFinalResults();
            });
        };
    }
}

function startNextGameRound() {
    console.log("🔄 جاري بدء جولة جديدة...");
    votingIndex = 0;
    isChallengeRevealed = false;
    isConfrontationMode = false;
    players.forEach(p => { p.isDead = false; });
    gameSettings.roles = [];
    currentRoleIndex = 0;
    if (typeof startRolesDistribution === "function") startRolesDistribution();
    else {
        playGameSound(errorSound);
        console.error("❌ دالة startRolesDistribution مش موجودة!");
        showCustomToast("⚠️ حصل مشكلة في بدء الجولة الجديدة");
    }
    if (typeof saveLobbyPlayers === "function") saveLobbyPlayers();
    playGameSound(alertSound);
    showCustomToast("🔥 بدأت جولة جديدة! تحديات جديدة!");
}

function handleArcadeVoteSlam(callback) {
    const gate = document.getElementById('neon-gate');
    if (!gate) { if (callback) callback(); return; }
    gate.classList.add('guillotine-slam-animation');
    setTimeout(() => {
        gate.classList.remove('guillotine-slam-animation');
        if (callback) callback();
    }, 300);
}

// تعديل بسيط هنا عشان نشيل الـ announcer مع الـ slide
function nextVoteRound() {
    if (typeof saveLobbyPlayers === "function") saveLobbyPlayers();
    const gate = document.getElementById('neon-gate');
    const announcer = document.getElementById('voting-target-player');
    if (gate) {
        playGameSound(swipeSound);
        gate.classList.add('slide-out');
        if (announcer) announcer.style.opacity = '0';
        setTimeout(() => {
            votingIndex++;
            showPlayerVoteCard();
            gate.classList.remove('slide-out');
            gate.classList.add('slide-in');
            setTimeout(() => { gate.classList.remove('slide-in'); }, 250);
        }, 200);
    } else {
        votingIndex++;
        showPlayerVoteCard();
    }
}

const btnMasterReveal = document.getElementById('btn-master-reveal');
if (btnMasterReveal) {
    btnMasterReveal.onclick = function () {
        isChallengeRevealed = true;
        playGameSound(swipeSound);
        const gate = document.getElementById('neon-gate');
        if (gate) { gate.classList.remove('gate-closed'); gate.classList.add('gate-open'); }
        if (isConfrontationMode) {
            document.getElementById('initial-actions-group').style.display = 'none';
            document.getElementById('verify-actions-group').style.display = 'none';
            const targetPlayerName = gameSettings.roles[caughtPlayerIndex].name;
            const spierName = players[selectedSpierIndex].name;
            revealChallengeAndJudge(targetPlayerName, spierName);
        } else {
            const btnVoteCaught = document.getElementById('btn-vote-caught');
            if (btnVoteCaught) btnVoteCaught.style.display = 'none';
            document.getElementById('initial-actions-group').style.display = 'none';
            document.getElementById('verify-actions-group').style.display = 'grid';
            const votingTargetEl = document.getElementById('voting-target-player');
            if (votingTargetEl) votingTargetEl.innerHTML = `شوفو التحدي! هل نفذه وقالو صح؟`;
        }
    };
}

function openSpierSelectionModal() {
    const modal = document.getElementById('confrontation-modal');
    const grid = document.getElementById('confrontation-listeners-container');
    const nextBtn = document.getElementById('btn-confirm-confrontation-player');
    if (nextBtn) nextBtn.disabled = true;
    let cancelBtn = document.getElementById('btn-cancel-confrontation');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-confrontation';
        cancelBtn.className = 'lobby-return-btn';
        cancelBtn.style.marginTop = '15px';
        if (modal) {
            const targetContainer = modal.querySelector('.modal-content, div');
            if (targetContainer) targetContainer.appendChild(cancelBtn);
            else modal.appendChild(cancelBtn);
        }
    }
    cancelBtn.onclick = function (e) {
        e.preventDefault();
        playGameSound(clickSound);
        isConfrontationMode = false;
        if (modal) modal.classList.add('hidden');
        showPlayerVoteCard();
    };
    if (grid) {
        grid.innerHTML = '';
        players.forEach((player, idx) => {
            if (player.name === gameSettings.roles[caughtPlayerIndex].name) return;
            const isDeadClass = player.isDead ? 'dead-player' : '';
            const isDisabled = player.isDead ? 'disabled' : '';
            const deadBadge = player.isDead ? ' <small style="color:#ff5252;">(مطرود 🚷)</small>' : '';
            const card = document.createElement('div');
            card.className = `listener-select-card ${isDeadClass}`;
            card.innerHTML = `
                <img src="${player.avatar || './img/per.png'}" class="listener-card-avatar" alt="Avatar">
                <span class="listener-card-name">${player.name}${deadBadge}</span>
                <input type="radio" name="confrontation-spier" value="${idx}" id="radio-confront-spier-${idx}" ${isDisabled}>
            `;
            card.addEventListener('click', () => {
                if (player.isDead) return;
                playGameSound(clickSound);
                const radio = card.querySelector('input[type="radio"]');
                if (radio) { radio.checked = true; if (nextBtn) nextBtn.disabled = false; }
            });
            grid.appendChild(card);
        });
    }
    if (nextBtn) {
        nextBtn.onclick = function (e) {
            e.preventDefault();
            playGameSound(clickSound);
            const selectedRadio = document.querySelector('input[name="confrontation-spier"]:checked');
            if (selectedRadio) {
                selectedSpierIndex = parseInt(selectedRadio.value);
                if (modal) modal.classList.add('hidden');
                showSpierGuessStep();
            }
        };
    }
    if (modal) modal.classList.remove('hidden');
}

function showSpierGuessStep() {
    const targetPlayerName = gameSettings.roles[caughtPlayerIndex].name;
    const spierName = players[selectedSpierIndex].name;
    const votingTargetEl = document.getElementById('voting-target-player');
    if (votingTargetEl) {
        votingTargetEl.innerHTML = `🗣️ ها يا <span style="color:#e67e22; font-weight:900;">${spierName}</span>، قفشت <span style="color:#ff4757; font-weight:900;">${targetPlayerName}</span> بيعمل إيه؟ <br><small style="color:#aaa;">قول تخمينك، واضغط على "العين" لكشف التحدي!</small>`;
    }
    document.getElementById('initial-actions-group').style.display = 'none';
    document.getElementById('verify-actions-group').style.display = 'none';
}

function revealChallengeAndJudge(targetPlayerName, spierName) {
    const currentVoteData = gameSettings.roles[caughtPlayerIndex];
    const votingTargetEl = document.getElementById('voting-target-player');
    if (votingTargetEl) votingTargetEl.innerHTML = `هل تخمين <span style="color:#e67e22; font-weight:900;">${spierName}</span> طلع صح؟`;
    const voteContainer = document.querySelector('.arcade-court-container');
    let judgeGrid = document.getElementById('judge-options-grid');
    if (!judgeGrid) {
        judgeGrid = document.createElement('div');
        judgeGrid.id = 'judge-options-grid';
        judgeGrid.className = 'arcade-voting-dock';
        if (voteContainer) voteContainer.appendChild(judgeGrid);
    }
    judgeGrid.style.display = 'flex';
    judgeGrid.innerHTML = `
        <button class="arcade-btn arcade-success" id="btn-judge-correct"><span class="btn-top">شك صح +1</span></button>
        <button class="arcade-btn arcade-failed" id="btn-judge-wrong"><span class="btn-top">شك غلط -1</span></button>
    `;
    document.getElementById('btn-judge-correct').onclick = function () {
        playGameSound(clickSound);
        handleArcadeVoteSlam(() => {
            players[selectedSpierIndex].score += 1;
            finalizeConfrontationRound();
        });
    };
    document.getElementById('btn-judge-wrong').onclick = function () {
        playGameSound(clickSound);
        handleArcadeVoteSlam(() => {
            players[selectedSpierIndex].score -= 1;
            const targetPIdx = players.findIndex(p => p.name === currentVoteData.name);
            if (targetPIdx !== -1) players[targetPIdx].score += 1;
            finalizeConfrontationRound();
        });
    };
}

function finalizeConfrontationRound() {
    const judgeGrid = document.getElementById('judge-options-grid');
    if (judgeGrid) judgeGrid.style.display = 'none';
    nextVoteRound();
}

function showFinalResults() {
    switchScreen('screen-results');
    playGameSound(victorySound);
    triggerGameVibrate([70, 60, 70, 60, 300]);
    const podiumDock = document.getElementById('podium-top3-dock');
    const runnersList = document.getElementById('results-runners-list');
    if (!podiumDock || !runnersList) return;
    podiumDock.innerHTML = '';
    runnersList.innerHTML = '';
    let sorted = [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' });
    });
    let top3 = sorted.slice(0, 3);
    let runners = sorted.slice(3);
    let orderedTop3 = [];
    if (top3[1]) orderedTop3.push({ p: top3[1], r: 2, textRank: 'الثاني', badge: '🥈', color: '#c0c0c0' });
    if (top3[0]) orderedTop3.push({ p: top3[0], r: 1, textRank: 'الأول', badge: '👑', color: '#ffd700' });
    if (top3[2]) orderedTop3.push({ p: top3[2], r: 3, textRank: 'الثالث', badge: '🥉', color: '#cd7f32' });
    orderedTop3.forEach(item => {
        const player = item.p;
        const podiumCard = document.createElement('div');
        podiumCard.className = `podium-rank-card rank-${item.r} ${player.isDead ? 'podium-dead' : ''}`;
        podiumCard.innerHTML = `
            <div class="podium-avatar-wrapper" style="border-color: ${item.color};">
                <span class="podium-crown-badge">${player.isDead ? '💀' : item.badge}</span>
                <img src="${player.avatar || './img/per.png'}" class="podium-avatar" alt="avatar" style="${player.isDead ? 'filter: grayscale(100%);' : ''}">
            </div>
            <div class="podium-player-name">${player.name}</div>
            <div class="podium-player-score" style="color: ${item.color};">${player.score} نقطة</div>
            <div class="podium-step-block" style="box-shadow: inset 0 0 20px ${item.color}44, 0 10px 30px rgba(0,0,0,0.6); justify-content: center; padding: 12px 2px;">
                <span class="podium-number" style="color: ${item.color}; text-shadow: 0 0 10px ${item.color}; font-size: clamp(0.9rem, 3vw, 1.2rem); font-weight: 900; margin: 0;">
                    ${item.textRank}
                </span>
            </div>
        `;
        podiumDock.appendChild(podiumCard);
    });
    runners.forEach((player, idx) => {
        const actualRank = idx + 4;
        let cardClass = 'runner-cyber-strip';
        if (player.isDead) cardClass += ' strip-player-expelled';
        const strip = document.createElement('div');
        strip.className = cardClass;
        strip.innerHTML = `
            <div class="strip-left-section">
                <span class="strip-rank-number">${player.isDead ? '💀' : `#${actualRank}`}</span>
                <img src="${player.avatar || './img/per.png'}" class="strip-avatar" ${player.isDead ? 'style="filter: grayscale(100%);"' : ''}>
                <span class="strip-player-name">${player.name}</span>
            </div>
            <div class="strip-right-section">
                <span class="strip-score-badge">${player.score} نقطة</span>
            </div>
        `;
        runnersList.appendChild(strip);
    });
}

// ==========================================================================
// 1️⃣3️⃣ إدارة الشاشات والتنقل (Screen Router)
// ==========================================================================
function switchScreen(screenId) {
    const appContainer = document.querySelector('.app-container');
    if (!appContainer) return;
    if (screenId === 'screen-lobby') {
        appContainer.classList.add('lobby-active');
        appContainer.classList.remove('screen-roles-active');
    } else if (screenId === 'screen-roles') {
        appContainer.classList.add('screen-roles-active');
        appContainer.classList.remove('lobby-active');
    } else {
        appContainer.classList.remove('lobby-active', 'screen-roles-active');
    }
    document.querySelectorAll('.game-screen').forEach(s => { s.classList.add('hidden'); });
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ==========================================================================
// 1️⃣4️⃣ منظومة السحب الذكي الموحدة (BackBoxes)
// ==========================================================================
function initDraggableBackBox(boxElement, btnElement, onReturnCallback) {
    if (!boxElement || !btnElement) return;

    window.addEventListener('load', () => { boxElement.classList.add('loaded'); });

    function openBox(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        boxElement.classList.add('open');
    }
    function closeBox() { boxElement.classList.remove('open'); }

    let isDragging = false;
    boxElement.addEventListener('click', (e) => {
        if (isDragging) return;
        if (!boxElement.classList.contains('open')) openBox(e);
    });

    btnElement.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isDragging) return;
        if (typeof onReturnCallback === 'function') onReturnCallback();
        closeBox();
    });

    document.addEventListener('click', (e) => {
        if (boxElement.classList.contains('open') && !boxElement.contains(e.target) && !isDragging) {
            closeBox();
        }
    });

    let isPointerDown = false;
    let startY = 0;
    let startTop = 25;

    function handlePointerMove(currentY) {
        if (!isPointerDown) return;
        let newTop = startTop + (currentY - startY);
        const elementHeight = boxElement.offsetHeight || 50;
        const maxTop = window.innerHeight - elementHeight - 15;
        const minTop = 15;
        if (newTop < minTop) newTop = minTop;
        if (newTop > maxTop) newTop = maxTop;
        boxElement.style.top = `${newTop}px`;
    }

    boxElement.addEventListener('touchstart', (e) => {
        isPointerDown = true; isDragging = false;
        startY = e.touches[0].clientY;
        startTop = parseInt(window.getComputedStyle(boxElement).top, 10) || 25;
    }, { passive: true });

    boxElement.addEventListener('touchmove', (e) => {
        if (!isPointerDown) return;
        if (Math.abs(e.touches[0].clientY - startY) > 4) isDragging = true;
        handlePointerMove(e.touches[0].clientY);
    }, { passive: true });

    boxElement.addEventListener('touchend', () => {
        isPointerDown = false;
        setTimeout(() => { isDragging = false; }, 80);
    });

    boxElement.addEventListener('mousedown', (e) => {
        isPointerDown = true; isDragging = false;
        startY = e.clientY;
        startTop = parseInt(window.getComputedStyle(boxElement).top, 10) || 25;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPointerDown) return;
        if (Math.abs(e.clientY - startY) > 4) isDragging = true;
        handlePointerMove(e.clientY);
    });

    window.addEventListener('mouseup', () => {
        isPointerDown = false;
        setTimeout(() => { isDragging = false; }, 80);
    });
}

// تفعيل السحب الذكي لكل الشاشات باستخدام الدالة الموحدة
document.addEventListener('DOMContentLoaded', () => {
    // اللوبي
    initDraggableBackBox(
        document.getElementById('lobbyBackBox'),
        document.getElementById('btn-back-to-main'),
        () => { console.log('العودة إلى القائمة الرئيسية...'); }
    );

    // الإعدادات
    initDraggableBackBox(
        document.getElementById('SettingBackBox'),
        document.getElementById('btn-back-from-settings'),
        () => { console.log('العودة من الإعدادات إلى القائمة الرئيسية...'); }
    );

    // المحكمة
    initDraggableBackBox(
        document.getElementById('courtBackBox'),
        document.getElementById('court-back-btn'),
        () => { console.log('العودة من شاشة المحكمة...'); }
    );

    // المتخصص
    const specialistBackBox = document.getElementById('specialistBackBox');
    const btnBackSpecialistToLobby = document.getElementById('btn-back-specialist-to-lobby');
    if (specialistBackBox && btnBackSpecialistToLobby) {
        initDraggableBackBox(
            specialistBackBox,
            btnBackSpecialistToLobby,
            () => {
                console.log('العودة من مود المتخصص إلى اللوبي...');
                resetSpecialistModeState();
                if (typeof switchScreen === "function") switchScreen('screen-lobby');
            }
        );
    }
});