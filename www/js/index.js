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
// 2️⃣ متغيرات حالة اللعبة العامة (State Management) - بدون أي تكرار
// ==========================================================================
let gameData = null; // التعريف الموحد والنظيف للداتا 🎯
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

// ==========================================================================
// 3️⃣ إدارة المؤثرات الصوتية والاهتزازات المركزية
// ==========================================================================
let isVibrationEnabled = true;
let isSoundEnabled = true;



// تعريف كائنات الأصوات لضمان الكاش والأداء العالي
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

// مصفوفة الأصوات المستمرة لكتمها فوراً عند حدوث أي أكشن جديد
const continuousSounds = [
    courtroomTypewriterSound,
    timerDangerSound,
    zeroingSound,
    victorySound,
    swipeSound
];

// 🔥 المسمار السحري: دالة بتلف على كل الأصوات وتجبر المتصفح يحملها في الرامات أول ما اللعبة تفتح
function forcePreloadAllSounds() {
    const allSounds = [
        errorSound, alertSound, soundOn, soundOff, clickSound,
        removeSound, swipeSound, courtroomTypewriterSound,
        countdownTickSound, victorySound, zeroingSound,
        timerDangerSound, whistleSound, startSound,
        addSound // 👈 ضيفه هنا في المصفوفة عشان يتعمل له بريلود
    ];

    allSounds.forEach(sound => {
        if (sound) sound.preload = 'auto';
    });
}

// تشغيل التحميل المسبق فوراً
document.addEventListener("DOMContentLoaded", () => {
    forcePreloadAllSounds();
});

function playGameSound(audioObject) {
    if (!isSoundEnabled || !audioObject) return;

    continuousSounds.forEach(sound => {
        if (sound && !sound.paused && sound !== audioObject) { // أمان عشان ميقفلش الصوت لو هو هو اللي شغال
            sound.pause();
            sound.currentTime = 0;
        }
    });

    audioObject.currentTime = 0; // 🔁 تصفير مؤشر الصوت فوراً عشان يشتغل من أول وجديد في نفس اللحظة
    audioObject.play().catch(e => console.log("تم حجب الصوت بواسطة سياسة المتصفح:", e));
}


function triggerGameVibrate(pattern) {
    if (isVibrationEnabled && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// جعل الدوال مرئية في النطاق العالمي لـ HTML
window.playGameSound = playGameSound;
window.triggerGameVibrate = triggerGameVibrate;

// ==========================================================================
// 4️⃣ دورة حياة التطبيق والتشغيل الأوفلاين (Cordova & Browser Lifecycle)
// ==========================================================================
localStorage.removeItem('lobby_players'); // ريست فوري للوبي عند بداية الجلسة

if (window.cordova) {
    document.addEventListener('deviceready', initApp, false);
} else {
    window.addEventListener('load', () => {
        console.log("وضع المتصفح: تخطي deviceready 🔥");
        initApp();
    });
}

// الدالة الأم المسؤولة عن بدء اللعبة بترتيب صحيح ومضمون
async function initApp() {
    console.log("التطبيق جاهز للعمل أوفلاين! 🚀");

    // أقرأ ملف الداتا أول حاجة عشان الشاشات متعتمدش على داتا فاضية
    await loadGameData();

    if (typeof refreshAvatarsPool === "function") {
        refreshAvatarsPool();
    }

    // ربط مستمعات الأحداث والأزرار بالـ DOM
    initEventListeners();

    // إخفاء الـ Splashscreen لو شغالين Cordova
    if (navigator.splashscreen) {
        navigator.splashscreen.hide();
    }

    // تشغيل فيديو الانترو أو الانيميشن الافتتاحي
    if (typeof handleIntroVideo === "function") {
        handleIntroVideo();
    }

    if (typeof loadLobbyPlayers === "function") {
        loadLobbyPlayers();
    }
}

// ==========================================================================
// 5️⃣ سحب البيانات أوفلاين (تحميل ملف الـ JSON الخارجي)
// ==========================================================================
async function loadGameData() {
    try {
        const response = await fetch('challenges.json');
        if (!response.ok) throw new Error("لم نتمكن من تحميل ملف القضايا والتحصينات");

        gameData = await response.json();
        console.log("✅ تم تحميل القضايا والتحديات بنجاح من challenges.json:", gameData);
    } catch (error) {
        console.error("❌ حدث خطأ أثناء تحميل الملف، سيتم تشغيل البيانات الاحتياطية:", error);
        if (typeof setupFallbackData === "function") {
            setupFallbackData();
        }
    }
}

// ==========================================================================
// 3️⃣ ربط الأحداث (Event Listeners) - نسخة مصلحة ومفصولة بالكامل ⚖️
// ==========================================================================
function initEventListeners() {
    console.log("🔥 initEventListeners Called");
    console.log("🔄 جاري ربط جميع عناصر الـ DOM والأحداث بدون تكرار وبكفاءة...");

    // ----------------------------------------------------
    // [1] إعدادات الثيم والألوان
    // ----------------------------------------------------
    if (typeof savedTheme !== 'undefined' && savedTheme) {
        let radioBtn = document.querySelector(`input[name="game-theme"][value="${savedTheme}"]`);
        if (radioBtn) radioBtn.checked = true;
    }

    document.querySelectorAll('input[name="game-theme"]').forEach(radio => {
        radio.addEventListener('change', function () {
            let selectedTheme = this.value;
            let themeColors = {
                'crimson': '#ff2a5f',
                'blue': '#3498db',
                'green': '#2ecc71',
                'purple': '#9b59b6',
                'gold': '#f1c40f'
            };

            if (themeColors[selectedTheme]) {
                document.documentElement.style.setProperty('--crimson', themeColors[selectedTheme]);
                localStorage.setItem('user-game-theme', selectedTheme);
                localStorage.setItem('user-theme', selectedTheme); // توحيد الكي المفتاح لو بتستخدمه
            }
        });
    });

    const themeModeToggle = document.getElementById('theme-mode-toggle');
    if (themeModeToggle) {
        themeModeToggle.addEventListener('change', (e) => {
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                if (e.target.checked) {
                    appContainer.classList.add('classic-theme');
                } else {
                    appContainer.classList.remove('classic-theme');
                }
            }
        });
    }

    // ----------------------------------------------------
    // [2] سويتشات التحكم المركزية (الصوت، الاهتزاز، المود)
    // ----------------------------------------------------
    const soundToggle = document.getElementById("sound-effects-toggle");
    if (soundToggle) {
        isSoundEnabled = soundToggle.checked;
        soundToggle.addEventListener("change", () => {
            isSoundEnabled = soundToggle.checked;
            playGameSound(isSoundEnabled ? soundOn : soundOff);
            console.log("حالة المؤثرات الصوتية:", isSoundEnabled ? "شغالة ✅" : "مكتومة ❌");
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
            console.log("حالة اهتزاز الهاتف:", isVibrationEnabled ? "شغالة ✅" : "مكتومة ❌");
        });
    }

    const specialistModeToggle = document.getElementById('specialist-mode-toggle');
    if (specialistModeToggle) {
        specialistModeToggle.addEventListener('change', (e) => {
            isSpecialistModeActive = e.target.checked;
            playGameSound(isSpecialistModeActive ? soundOn : soundOff);

            const badge = document.getElementById('specialist-badge');
            if (badge) {
                if (isSpecialistModeActive) {
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        });
    }

    const customToggle = document.getElementById('custom-challenges-toggle');
    if (customToggle) {
        customToggle.addEventListener('change', (e) => {
            const customArea = document.getElementById('custom-challenges-area');
            if (customArea) {
                if (e.target.checked) {
                    customArea.classList.remove('hidden');
                } else {
                    customArea.classList.add('hidden');
                }
            }
        });
    }

    // ----------------------------------------------------
    // [3] أزرار التنقل وشاشات اللعبة الرئيسية (مع فك حظر الصوت)
    // ----------------------------------------------------
    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
        btnStartGame.addEventListener('click', () => {
            console.log("🔊 جاري فك حظر الأصوات من المتصفح...");

            // كل الأصوات في مصفوفة لفك الحظر مرة واحدة
            const allSounds = [
                soundOn, soundOff, clickSound, removeSound, swipeSound,
                errorSound, alertSound, courtroomTypewriterSound,
                countdownTickSound, victorySound, zeroingSound,
                timerDangerSound, whistleSound, startSound
            ];

            allSounds.forEach(sound => {
                if (sound) {
                    sound.play().then(() => {
                        sound.pause();
                        sound.currentTime = 0;
                    }).catch(e => console.log("تم تخطي صوت غير جاهز بعد أو تم فكه مسبقاً"));
                }
            });

            if (typeof switchScreen === "function") switchScreen('screen-lobby');
            if (typeof loadLobbyPlayers === "function") loadLobbyPlayers();
        });
    }

    const btnOpenSettings = document.getElementById('btn-open-settings');
    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => {
            if (typeof switchScreen === "function") switchScreen('screen-settings');
        });
    }

    const btnBackFromSettings = document.getElementById('btn-back-from-settings');
    if (btnBackFromSettings) {
        btnBackFromSettings.addEventListener('click', () => {
            if (typeof switchScreen === "function") switchScreen('screen-main');
        });
    }

    const btnBackToMain = document.getElementById('btn-back-to-main');
    if (btnBackToMain) {
        btnBackToMain.addEventListener('click', () => {
            if (typeof switchScreen === "function") switchScreen('screen-main');
        });
    }

    // ----------------------------------------------------
    // [4] إدارة اللوبي وإضافة اللاعبين
    // ----------------------------------------------------
    const btnAddPlayer = document.getElementById('btn-add-player');
    if (btnAddPlayer && typeof addPlayerFromInput === "function") {
        btnAddPlayer.addEventListener('click', addPlayerFromInput);
    }

    const playerNameInput = document.getElementById('player-name-input');
    if (playerNameInput && typeof addPlayerFromInput === "function") {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPlayerFromInput();
        });
    }

    // ----------------------------------------------------
    // [5] أزرار الـ Gameplay والتفاعل والأصوات المباشرة
    // ----------------------------------------------------
    const gameButtons = [
        { id: "btn-share-ideas", sound: clickSound },
        { id: "btn-support-mail", sound: clickSound },
        { id: "btn-i-am-player", sound: clickSound },
        { id: "btn-expel-player", sound: removeSound },
        { id: "btn-master-reveal", sound: swipeSound },
        { id: "btn-vote-success-init", sound: clickSound },
        { id: "btn-vote-failed-init", sound: clickSound },
        { id: "btn-vote-caught", sound: clickSound },
        { id: "btn-verify-true", sound: clickSound },
        { id: "btn-verify-false", sound: clickSound }
    ];

    gameButtons.forEach(btnConfig => {
        const btn = document.getElementById(btnConfig.id);
        if (btn) {
            btn.addEventListener("click", () => playGameSound(btnConfig.sound));
        }
    });

    // سياقات خارجية (الفورمز والدعم)
    const shareIdeasBtn = document.getElementById('btn-share-ideas');
    if (shareIdeasBtn) {
        shareIdeasBtn.addEventListener('click', function () {
            let googleFormUrl = "https://forms.gle/WbiNNDuXsMCGHMJJ8";
            window.open(googleFormUrl, '_system');
        });
    }

    const btnSupportMail = document.getElementById('btn-support-mail');
    if (btnSupportMail) {
        btnSupportMail.addEventListener('click', function () {
            let phoneNumber = "201050041446";
            let messageText = "اهلاا يا عمر! 👋🔥\n\n" +
                "أنا جاي من جوة لعبة 'في الاستخبُص' وكنت حابب اتكلم معاك في موضوع سريع :\n" +
                "💬 [اكتب حوارك السريع، رأيك، أو فكرة بيزنس وتطوير هنا]\n\n";
            let whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`;
            window.open(whatsappUrl, '_blank');
        });
    }

    // ----------------------------------------------------
    // [6] منطق مود المتخصص والعداد وجاهزين في اللوبي
    // ----------------------------------------------------
    const btnBackSpecialistToLobby = document.getElementById('btn-back-specialist-to-lobby');
    if (btnBackSpecialistToLobby) {
        btnBackSpecialistToLobby.addEventListener('click', () => {
            if (typeof switchScreen === "function") switchScreen('screen-lobby');
        });
    }

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
    if (btnSubmitSpecialistGame) {
        btnSubmitSpecialistGame.addEventListener('click', () => {
            if (typeof startRolesDistribution === "function") startRolesDistribution();
        });
    }

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
    if (btnRoleDone) {
        btnRoleDone.addEventListener('click', () => {
            if (typeof nextPlayerRoleTurn === "function") nextPlayerRoleTurn();
        });
    }

    // ----------------------------------------------------
    // [7] ساحة المحكمة والتصويت والإنهاء
    // ----------------------------------------------------
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
            if (courtScreen && !courtScreen.classList.contains('hidden')) {
                isTimerPaused = false;
            }
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

            const selectorsToClear = [
                '.roles-challenge-text', '#challenge-text-content',
                '.roles-badge-element', '#player-role-badge',
            ];
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

    // شاشة التصويت والدرج السري
    const btnPullDrawer = document.getElementById('btn-pull-drawer');
    if (btnPullDrawer) {
        btnPullDrawer.addEventListener('click', () => {
            const drawer = document.getElementById('secret-drawer');
            if (drawer) drawer.classList.add('open');
        });
    }
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', () => {
            const drawer = document.getElementById('secret-drawer');
            if (drawer) drawer.classList.remove('open');
        });
    }

    // ----------------------------------------------------
    // [8] إعادة اللعب والإنهاء النهائي وTime Chips وHelp Modal
    // ----------------------------------------------------
    const btnRestartSame = document.getElementById('btn-restart-same');
    if (btnRestartSame) {
        btnRestartSame.onclick = function () {
            if (typeof handleArcadeVoteSlam === "function") {
                handleArcadeVoteSlam(() => {
                    players.forEach(p => {
                        p.score = 0;
                        p.isDead = false;
                    });

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
            setTimeout(() => {
                helpModal.classList.add("hidden");
            }, 350);
        };

        if (closeHelpBtn) closeHelpBtn.addEventListener("click", closeModalWithSwipe);

        helpModal.addEventListener("click", (e) => {
            if (e.target === helpModal) {
                closeModalWithSwipe();
            }
        });
    }

    console.log("✅ كود نضيف، متصفي، وجاهز للشغل بدون أي كراشات يا ريس!");
}


function handleSpecialistChallengeSend() {
    setTimeout(() => {
        let currentCount = specialistChallengesList.length;
        let requiredCount = players.length;

        const insertedEl = document.getElementById('inserted-challenges-count');
        if (insertedEl) {
            insertedEl.innerText = currentCount;
        }

        const inputEl = document.getElementById('specialist-challenge-input');
        const sendBtn = document.getElementById('btn-send-specialist-challenge');
        const startBtn = document.getElementById('btn-submit-specialist-game');

        // 1️⃣ الحالة الأولى: أول ما التحديات تكمل بالظبط (العدد مساوي أو أكبر)
        if (currentCount >= requiredCount) {
            if (inputEl) {
                inputEl.disabled = true;
                inputEl.value = ''; // نضف الخانة
                inputEl.placeholder = 'اكتملت التحديات! ابدأ الآن';
            }
            if (sendBtn) {
                sendBtn.setAttribute('disabled', 'true');
                sendBtn.classList.add('disabled-btn');
                sendBtn.style.opacity = "0.5";
                sendBtn.style.pointerEvents = "none";
            }
            if (startBtn) {
                startBtn.removeAttribute('disabled');
                startBtn.classList.remove('disabled-btn');
                startBtn.style.background = 'linear-gradient(135deg, #ff2a5f 0%, #b3003b 100%)';
                startBtn.style.color = '#fff';
                startBtn.style.boxShadow = '0 0 20px rgba(255, 42, 95, 0.5)';
            }
        }
        // 2️⃣ الحالة الثانية: التحدي اتبعث ولسه فيه مكان لتحديات تانية (مكملناش العدد)
        else {
            if (inputEl) {
                inputEl.disabled = false;
                inputEl.value = ''; // 🚀 بنفضي الـ Input عشان يكتب التحدي الجديد
                inputEl.placeholder = 'اكتب التحدي السري هنا...';
            }
            if (sendBtn) {
                /* 🚀 بنرجع نقفل زرار الإرسال توماتيك عشان الـ Input بقى فاضي 
                   ومستني يكتب حرف جديد للتحدي التالي */
                sendBtn.setAttribute('disabled', 'true');
                sendBtn.style.opacity = "0.5";
                sendBtn.style.pointerEvents = "none";
            }
        }
    }, 30);
}

// 🧼 دالة التصفير الشاملة والآمنة لوضع المتخصص (المحدثة بدون تدمير الجيم الحالي)
function resetSpecialistModeState() {
    console.log("🔄 جاري تصفير وتنظيف مدخلات وضع المتخصص...");

    // 1. تصفير مصفوفة المدخلات المكتوبة فقط (لا تلمس gameSettings.roles هنا نهائياً!)
    specialistChallengesList = [];

    // 2. تصفير العداد المعروض في الـ HTML
    const insertedCounter = document.getElementById('inserted-challenges-count');
    if (insertedCounter) {
        insertedCounter.innerText = "0";
    }

    // 3. إعادة تهيئة خانة الإدخال (Input)
    const challengeInput = document.getElementById('specialist-challenge-input');
    if (challengeInput) {
        challengeInput.disabled = false;
        challengeInput.placeholder = "اكتب التحدي السري هنا...";
        challengeInput.value = "";
    }

    // 4. قفل زرار الإرسال تلقائياً (لأن الخانة فضيت)
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    if (sendBtn) {
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.classList.add('disabled-btn');
        sendBtn.style.opacity = "0.5";
        sendBtn.style.pointerEvents = "none";
    }

    // 5. قفل زرار بدء اللعبة (المتخصص) لحين كتابة تحديات جديدة
    const submitGameBtn = document.getElementById('btn-submit-specialist-game');
    if (submitGameBtn) {
        submitGameBtn.setAttribute('disabled', 'true');
        submitGameBtn.classList.add('disabled-btn');
        submitGameBtn.style.background = '';
        submitGameBtn.style.boxShadow = '';
    }
}

// ==========================================================================
// 4️⃣ منطق اللوبي (الأفاتار، الرندر، والـ LocalStorage) - نسخة الـ 10 صور الصخر 💎
// ==========================================================================
function saveLobbyPlayers() {
    localStorage.setItem('lobby_players', JSON.stringify(players));
}

function loadLobbyPlayers() {
    const saved = localStorage.getItem('lobby_players');

    if (saved) {
        players = JSON.parse(saved);
    } else {
        players = [];
    }

    refreshAvatarsPool();
    renderPlayers();
}

function refreshAvatarsPool() {

    availableAvatars = [];

    for (let i = 1; i <= 10; i++) {

        const avatar = `./img/avatar${i}.png`;

        // لو الصورة مستخدمة متضيفهاش
        if (!players.some(p => p.avatar === avatar)) {
            availableAvatars.push(avatar);
        }
    }

    // Shuffle
    for (let i = availableAvatars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableAvatars[i], availableAvatars[j]] = [availableAvatars[j], availableAvatars[i]];
    }
}

function getNextUniqueAvatar() {
    if (!window.availableAvatars || availableAvatars.length === 0) {
        refreshAvatarsPool();
    }

    return availableAvatars.shift();
}

function addPlayerFromInput() {
    const input = document.getElementById('player-name-input');
    if (!input) return;

    // 🔥 1. الفحص الأول والحاسم: لو العدد وصل 10 اقطع الدالة فوراً
    if (players.length >= 10) {
        playGameSound(errorSound);
        triggerGameVibrate([80, 80, 250]);
        showCustomToast("🚨 انتو كده كتير اوي هما 10 بس!");
        input.value = '';
        return;
    }

    const name = input.value.trim();

    // 2. فحص الأسماء الفاضية أو المتكررة
    if (name && !players.some(p => p.name === name)) {
        const playerAvatar = getNextUniqueAvatar();
        players.push({ name: name, score: 0, avatar: playerAvatar });

        // 🔊 تشغيل صوت الـ add.mp3 الجديد بعد نجاح الإضافة
        if (typeof addSound !== 'undefined') {
            playGameSound(addSound);
        }

        // هزة خفيفة تدل على النجاح
        triggerGameVibrate([40]);

        input.value = '';
        saveLobbyPlayers();
        renderPlayers();
    } else if (name) {
        // لو الاسم متكرر
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
    if (currentCountSpan) currentCountSpan.innerText = players.length;

    players.forEach((player) => {
        const chipHTML = `
        <div class="player-chip" data-player-name="${player.name}">
            <button class="remove-player-btn" onclick="removePlayer('${player.name}', event); playGameSound(removeSound)">×</button>
            <div class="player-info-side">
                <span class="player-name-text">${player.name}</span>
                <img src="${player.avatar}" class="player-avatar" alt="User">
            </div>
        </div>
    `;
        listContainer.innerHTML += chipHTML;
    });
}

// ==========================================================================
// 🗑️ REMOVE PLAYER (حذف لاعب مع أنيميشن الزحلقة لشمال الكارت)
// ==========================================================================
window.removePlayer = function (playerName, e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    // الوصول للـ chip المفتوح عن طريق الـ event
    const clickedBtn = e ? e.target : null;
    let playerChip = clickedBtn ? clickedBtn.closest('.player-chip') : null;

    // Fallback: لو الـ event مجابش الكارت، بندور عليه بالاسم
    if (!playerChip) {
        playerChip = document.querySelector(`.player-chip[data-player-name="${playerName}"]`);
    }

    if (!playerChip) return;

    // 🔥 إضافة كلاس الأنيميشن (المطابق للـ CSS)
    playerChip.classList.add('removing');
    playerChip.style.pointerEvents = 'none'; // منع الضغط المتكرر

    // دالة التنظيف: حذف اللاعب من الـ Array وتحديث الواجهة
    const cleanup = () => {
        const targetIndex = players.findIndex(p => p.name === playerName);
        if (targetIndex !== -1) {
            // ترجيع الأفاتار للـ Pool عشان حد تاني ياخده
            if (window.availableAvatars && players[targetIndex].avatar) {
                availableAvatars.push(players[targetIndex].avatar);

                // Shuffle
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

    // ✨ استخدام animationend event للحذف بعد انتهاء الأنيميشن بالظبط
    let animationHandled = false;
    playerChip.addEventListener('animationend', () => {
        if (!animationHandled) {
            animationHandled = true;
            cleanup();
        }
    }, { once: true });

    // 🛡️ Fallback: لو الأنيميشن ماشتغلش لأي سبب، نحذف بعد 500ms
    setTimeout(() => {
        if (!animationHandled) {
            animationHandled = true;
            cleanup();
        }
    }, 200);
};

// ==========================================================================
// 5️⃣ توزيع الأدوار وكارت السحب السري (مخ اللعبة المحدث 🧠)
// ==========================================================================
function getRandomFormattedCase() {
    if (!gameData || !gameData.cases || gameData.cases.length === 0) return "لا توجد قضايا متاحة";
    if (players.length < 2) return "لازم لاعبين اتنين على الأقل في اللوبي عشان الأسامي تطلع مظبوطة!";

    // 1. اختيار قضية عشوائية
    let randomIndex = Math.floor(Math.random() * gameData.cases.length);
    let rawCase = gameData.cases[randomIndex];

    // 2. خلط مصفوفة اللاعبين عشوائياً عشان نختار اتنين مختلفين
    let shuffledPlayers = [...players].sort(() => 0.5 - Math.random());

    // سحب أسامي المتحدثين (بيدعم لو كائن أو نص مجرد)
    let player1Name = shuffledPlayers[0].name || shuffledPlayers[0];
    let player2Name = shuffledPlayers[1].name || shuffledPlayers[1];

    // 3. استبدال الرموز بالأسامي الحقيقية
    let formattedCase = rawCase
        .replace("[PLAYER1]", player1Name)
        .replace("[PLAYER2]", player2Name);

    return formattedCase;
}

function setupRolesBackButton() {
    const backBtn = document.getElementById('btn-back-from-roles');
    const confirmModal = document.getElementById('custom-confirm-modal');
    const confirmYesBtn = document.getElementById('btn-confirm-yes');
    const confirmNoBtn = document.getElementById('btn-confirm-no');

    if (!backBtn) return;

    // ربط زرار الباك بفتح المودال
    backBtn.onclick = function (e) {
        e.preventDefault();
        if (confirmModal) confirmModal.classList.remove('hidden');
    };

    if (confirmNoBtn) {
        confirmNoBtn.onclick = function () {
            if (confirmModal) confirmModal.classList.add('hidden');
        };
    }

    if (confirmYesBtn) {
        // 🔥 الحل الجذري: نستخدم addEventListener عشان نضمن إن الكود بتاعنا هيتنفذ دايماً ومش هيتمسح
        confirmYesBtn.addEventListener('click', function () {
            if (confirmModal) confirmModal.classList.add('hidden');

            // 1. تنظيف شاشة الأدوار الكروت
            const selectorsToClear = [
                '.roles-challenge-text', '#challenge-text-content',
                '.roles-badge-element', '#player-role-badge',
            ];

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

            // 2. تصفير العداد البرمجي والـ HTML للمتخصص فوراً
            specialistChallengesList = [];
            gameSettings.roles = [];
            currentRoleIndex = 0;

            const insertedCounter = document.getElementById('inserted-challenges-count');
            if (insertedCounter) {
                insertedCounter.innerText = "0";
            }

            // 3. تأخير فتح الأزرار 50 ملي ثانية (setTimeout) عشان نضمن إنها تتنفذ بـ الأولوية بعد ما كود اللعبة التاني يخلص مسحه
            setTimeout(() => {
                const challengeInput = document.getElementById('specialist-challenge-input');
                const sendBtn = document.getElementById('btn-send-specialist-challenge');
                const submitGameBtn = document.getElementById('btn-submit-specialist-game');

                if (challengeInput) {
                    challengeInput.disabled = false;
                    challengeInput.placeholder = "اكتب التحدي السري هنا...";
                    challengeInput.value = "";
                }
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.style.opacity = "1";
                    sendBtn.style.pointerEvents = "auto";
                }
                if (submitGameBtn) {
                    submitGameBtn.setAttribute('disabled', 'true');
                    submitGameBtn.classList.add('disabled-btn');
                    submitGameBtn.style.background = ''; // يرجع للـ CSS الأصلي
                }

                console.log("🧼 تم تنظيف وفتح أزرار المتخصص بنجاح من شاشة الأدوار!");
            }, 50);

            // 4. اخرج للوبي
            switchScreen('screen-lobby');
        });
    }
}

// دالة ريست وتفعيل أزرار المتخصص عند الرجوع للوبي من شاشة التحديات نفسها
function setupSpecialistBackButton() {
    const backBtn = document.getElementById('btn-back-specialist-to-lobby');
    if (!backBtn) return;

    backBtn.onclick = function (e) {
        e.preventDefault();

        const challengeInput = document.getElementById('specialist-challenge-input');
        const sendBtn = document.getElementById('btn-send-specialist-challenge');
        const submitGameBtn = document.getElementById('btn-submit-specialist-game');
        const insertedCounter = document.getElementById('inserted-challenges-count');

        // 1. تصفير العداد في الـ HTML
        if (insertedCounter) {
            insertedCounter.innerText = "0";
        }

        // 2. إعادة تصفير الـ Input وقفل زرار الإرسال (لأن الـ input بقا فاضي)
        if (challengeInput) {
            challengeInput.disabled = false;
            challengeInput.placeholder = "اكتب التحدي السري هنا...";
            challengeInput.value = "";
        }
        if (sendBtn) {
            sendBtn.disabled = true; // 🔒 مقفول توماتيك لحد ما يكتب
            sendBtn.style.opacity = "0.5";
            sendBtn.style.pointerEvents = "none";
        }

        // 3. قفل زرار بدء توزيع الكروت تاني لحد ما تكتبوا من جديد
        if (submitGameBtn) {
            submitGameBtn.setAttribute('disabled', 'true');
            submitGameBtn.classList.add('disabled-btn');
            submitGameBtn.style.background = '';
        }

        // 4. تصفير المصفوفة برمجياً
        specialistChallengesList = [];

        // 5. الرجوع لشاشة اللوبي الأساسية
        switchScreen('screen-lobby');
    };
}

// 🚀 الكود السحري اللي هيرجعه يبعت وينور أول ما اللاعب يكتب حرف واحد:
// 🚀 الكود المطور اللي هيخلي الزرار ينور فوراً ويشيل كلاس الضلمة
document.getElementById('specialist-challenge-input').addEventListener('input', function () {
    const sendBtn = document.getElementById('btn-send-specialist-challenge');
    if (!sendBtn) return;

    if (this.value.trim().length > 0) {
        sendBtn.removeAttribute('disabled');

        // 🎯 السحر هنا: بنشيل كلاس الضلمة اللي كان معلق ومخليه مطفي
        sendBtn.classList.remove('disabled-btn');

        // تأكيد على الـ Styles المباشرة عشان تنور بالكامل
        sendBtn.style.opacity = "1";
        sendBtn.style.pointerEvents = "auto";
        sendBtn.style.filter = "none"; // شيل أي جراي سكيل
    } else {
        // لو مسح الكلام ورجع فاضي، رجع الـ Reset والضلمة
        sendBtn.setAttribute('disabled', 'true');
        sendBtn.classList.add('disabled-btn');
        sendBtn.style.opacity = "0.5";
        sendBtn.style.pointerEvents = "none";
    }
});

// تشغيل الدالة فور تحميل التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSpecialistBackButton);
} else {
    setupSpecialistBackButton();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRolesBackButton);
} else {
    setupRolesBackButton();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startRolesDistribution() {
    const errorSound = new Audio('../sounds/error.m4a');

    if (players.length < 3) {
        playGameSound(errorSound);
        triggerGameVibrate([80, 80, 250]);
        showCustomToast(" ⚠️ الجيم محتاج على الأقل 3 لعيبة علشان تدخلوا ");
        return;
    }

    gameSettings.timeLimit = selectedGameTime;
    gameSettings.useCustomChallenges = false;
    gameSettings.roles = [];

    // 1️⃣ خلط اللعيبة عشوائي تماماً (رجعنا للطبيعة النظيفة 🎲)
    let shuffledIndices = players.map((_, i) => i).sort(() => Math.random() - 0.5);

    let vipIndices = [];
    if (players.length <= 5) {
        vipIndices.push(shuffledIndices[0]); // 1 VIP بس عشوائي
    } else {
        vipIndices.push(shuffledIndices[0], shuffledIndices[1]); // 2 VIP عشوائي
    }

    // تأمين الحاوية
    let dataContainer = gameData || {
        "cases": ["القضية ضاعت في المحكمة! اتصرفوا وحوروا."],
        "challenges": [{ "text": "اتكلم بثقة وبس" }]
    };

    // 2️⃣ السحر هنا: بناخد نسخة من مصفوفة التحديات المباشرة بتاعتك ونخلطها كلها برة
    let mainChallengesPool = [];
    if (dataContainer && Array.isArray(dataContainer.challenges)) {
        mainChallengesPool = [...dataContainer.challenges];
    } else if (dataContainer && dataContainer.challenges && Array.isArray(dataContainer.challenges.verbal)) {
        mainChallengesPool = [...dataContainer.challenges.verbal, ...dataContainer.challenges.action];
    }

    // لو مفيش داتا خالص، حط تحدي احتياطي عشان الـ Crash
    if (mainChallengesPool.length === 0) {
        mainChallengesPool = [{ "text": "اتكلم بثقة وبس وحاول تسوح اللي قدامك" }];
    }

    // خلط التحديات كلها بالكامل
    shuffleArray(mainChallengesPool);

    // 3️⃣ توزيع الأدوار والـ VIP بدون أي تكرار نهائياً
    players.forEach((player, idx) => {
        let isVip = vipIndices.includes(idx);
        let challengeText = "اتكلم بثقة وبس";
        let challengeTitle = "تحدي سري 🎯";
        let challengeType = "عام ⚖️";

        if (mainChallengesPool.length === 0) {
            mainChallengesPool = [...dataContainer.challenges];
            shuffleArray(mainChallengesPool);
        }

        if (mainChallengesPool.length > 0) {
            let selectedChallenge = mainChallengesPool.pop();
            challengeText = selectedChallenge.text || "اتكلم بثقة وبس";
            challengeTitle = selectedChallenge.title || "تحدي سري 🎯";
        }

        let roleTitle = isVip ? "VIP 🔥" : "لاعب 🎮";
        let roleClass = isVip ? "crimson" : "grey";

        gameSettings.roles.push({
            playerIndex: idx,
            name: player.name,
            roleTitle: roleTitle,
            roleClass: roleClass,
            challengeType: challengeType,
            challengeText: challengeText,
            challengeTitle: challengeTitle,
            isExpelled: false
        });
    });

    // 4️⃣ اختيار القضية
    const randomCase = dataContainer.cases[Math.floor(Math.random() * dataContainer.cases.length)];
    const caseEl = document.getElementById('court-case-text');
    if (caseEl) {
        caseEl.setAttribute('data-target-case', randomCase);
    }

    // 5️⃣ تأمين طور المتخصص (لو شغال)
    if (isSpecialistModeActive && specialistChallengesList.length > 0) {
        let shuffledSpecialist = [...specialistChallengesList];
        shuffleArray(shuffledSpecialist);

        gameSettings.roles.forEach((roleObj) => {
            if (shuffledSpecialist.length === 0) {
                shuffledSpecialist = [...specialistChallengesList];
                shuffleArray(shuffledSpecialist);
            }

            roleObj.challengeText = shuffledSpecialist.pop();
            roleObj.challengeTitle = "تحدي مخصص ⚡";
            roleObj.challengeType = "متخصص 🧠";
        });

        shuffleArray(gameSettings.roles);
        resetSpecialistModeState();
    }

    currentRoleIndex = 0;
    showRoleTurn();
    switchScreen('screen-roles');
}


let forcedVipName = null; // 🔥 المخزن السري لاسم الـ VIP المحظوظ
let arrowClicksCount = 0;

function showRoleTurn() {
    let currentTurnData = gameSettings.roles[currentRoleIndex];
    arrowClicksCount = 0;

    const arrowContainer = document.querySelector('.swipe-arrow-indicator');
    const coverCard = document.getElementById('swipe-cover-card');

    if (arrowContainer) arrowContainer.classList.remove('vip-arrows-flipped');
    if (coverCard) coverCard.removeAttribute('data-vip');

    initPlayerRoleScreen(currentTurnData);

    if (arrowContainer && coverCard) {
        const handleArrowHack = function (e) {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();

            if (e.type === 'touchstart') arrowContainer.isTouched = true;
            if (e.type === 'click' && arrowContainer.isTouched) {
                arrowContainer.isTouched = false;
                return;
            }

            arrowClicksCount++;

            if (arrowClicksCount === 5) {
                // 1️⃣ افتح السحب لليمين فوراً للاعب الحالي
                coverCard.setAttribute('data-vip', 'true');
                forcedVipName = currentTurnData.name;

                // 2️⃣ 🚨 الاستبدال الذكي (تبديل رأس برأس بدل مسح الكل) 🚨
                // لو اللاعب الحالي مش VIP أصلاً، هنبدله مع أول VIP عشوائي متاح في الجيم
                if (currentTurnData.roleTitle !== "VIP 🔥") {

                    // بندور على أول لاعب في المصفوفة يكون VIP (ومش هو اللاعب الحالي)
                    const victimVip = gameSettings.roles.find(roleObj =>
                        roleObj.roleTitle === "VIP 🔥" && roleObj.name !== currentTurnData.name
                    );

                    // لو لقينا ضحية.. اسحب منها اللقب فوراً ونزلها لمرتبة مواطن غلبان
                    if (victimVip) {
                        victimVip.roleTitle = "لاعب 🎮";
                        victimVip.roleClass = "grey";
                        console.log(`🎯 شفرة ذكية: تم سحب الـ VIP من [${victimVip.name}] وتحويله لـ [${currentTurnData.name}] للحفاظ على العدد الكلي.`);
                    } else {
                        console.log(`🎯 شفرة ذكية: مفيش VIP تاني في الجيم فتم تحويلك مباشرة.`);
                    }

                    // تثبيت اللاعب الحالي كـ VIP
                    currentTurnData.roleTitle = "VIP 🔥";
                    currentTurnData.roleClass = "crimson";

                    // تحديث البادج في الشاشة حالاً عشان يشوف اللقب الجديد
                    const badge = document.getElementById('player-role-badge');
                    if (badge) {
                        badge.innerText = "VIP 🔥";
                        badge.className = "roles-badge-element crimson";
                    }
                } else {
                    console.log(`😎 إنت أصلاً VIP يا برنس من عند ربنا، الشفرة فتحت لك السحب يمين بس!`);
                }

                // شقلب الأسهم
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
        console.log("🎬 جاري تحضير المحكمة ورا الكواليس...");
        startPreGameCountdown();
    }
}

let isSwiping = false;
let startX = 0;
let currentX = 0;
let cardWidth = 0;

function initPlayerRoleScreen(playerData) {
    const nextPlayerNameEl = document.getElementById('next-player-name');
    const roleTurnUsernameEl = document.getElementById('role-turn-username');
    const challengeTextContentEl = document.getElementById('challenge-text-content');
    const badge = document.getElementById('player-role-badge');

    if (nextPlayerNameEl) nextPlayerNameEl.innerText = playerData.name;
    if (roleTurnUsernameEl) roleTurnUsernameEl.innerText = playerData.name;
    if (challengeTextContentEl) challengeTextContentEl.innerText = playerData.challengeText;

    if (badge) {
        badge.innerText = playerData.roleTitle;
        badge.className = `roles-badge-element ${playerData.roleClass || 'grey'}`;
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
        // تأمين حساب عرض الكارت فوراً بدل ما نستنى الضغطة
        cardWidth = coverCard.offsetWidth || 340;
    }
    if (cardContent) {
        cardContent.style.opacity = '0';
        cardContent.classList.remove('revealed-glow');
    }
    if (doneBtn) doneBtn.classList.add('hidden');
    if (guideText) guideText.innerText = "بص في شاشتك لوحدك";

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
        // زيادة أمان: لو العرض متحسبش، احسبه هنا
        if (coverCard && (!cardWidth || cardWidth === 0)) cardWidth = coverCard.offsetWidth || 340;
    }

    function swipeMove(e) {
        if (!isSwiping) return;
        currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let deltaX = currentX - startX;

        // الشيك السري من الكارت مباشرة
        const isVipHacked = coverCard && coverCard.getAttribute('data-vip') === 'true';

        // لاعب عادي وسحب شمال (deltaX < 0) أو VIP وسحب يمين (deltaX > 0)
        if ((!isVipHacked && deltaX < 0) || (isVipHacked && deltaX > 0)) {
            let rotation = deltaX * 0.05;
            if (coverCard) coverCard.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;

            let swipePercentage = (Math.abs(deltaX) / cardWidth) * 100;
            if (swipePercentage >= 30) {
                isSwiping = false;

                playGameSound(swipeSound);

                // طير الكارت في الاتجاه المظبوط
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
        const caseTextElement = document.getElementById("case-text-display");
        if (caseTextElement) {
            caseTextElement.innerText = getRandomFormattedCase();
        }

        if (coverCard) {
            coverCard.style.transition = 'transform 0.08s ease-out, opacity 0.08s ease-out';
            if (direction === 'right') {
                coverCard.classList.add('fly-away-right');
            } else {
                coverCard.classList.add('fly-away-left');
            }
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

// دالة لتأمين قفل خانة الإدخال ومراقبة زرار الـ Enter لأسلوب المتخصص
function monitorSpecialistInput() {
    const challengeInput = document.getElementById('specialist-challenge-input');
    const sendBtn = document.getElementById('btn-send-specialist-challenge');

    if (!challengeInput || !sendBtn) return;

    // 1. منع كسر السطر وتشغيل الإرسال بالـ Enter
    challengeInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!sendBtn.disabled) {
                sendBtn.click();
            }
        }
    });

    // 2. مراقبة مستمرة للعدد مساوية لعدد اللاعبين
    sendBtn.addEventListener('click', function () {
        setTimeout(() => {
            // نأخذ القراءة من handleSpecialistChallengeSend مباشرة لتوحيد منطق الفحص الحركي
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
        }, 50); // رفع المهلة لـ 50 ملي ثانية لضمان الاستقرار الفعلي للمصفوفات المترابطة
    });
}

// تشغيل دالة المراقبة فور تحميل الـ DOM أو التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorSpecialistInput);
} else {
    monitorSpecialistInput();
}

// ==========================================================================
// 6️⃣ ساحة المحكمة والعداد الحسابي الدائري 🛑
// ==========================================================================
let typewriterTimeout = null;

function startPreGameCountdown() {
    // تصفير أي عداد قديم فوراً لمنع تسارع الوقت القاتل
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (typewriterTimeout) clearTimeout(typewriterTimeout);

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

    // 💥 المرة الأولى: تشغيل الصوت فوراً مع ظهور رقم 3
    playGameSound(countdownTickSound);

    // تحضير المواصفات مبكراً بشكل آمن
    setTimeout(() => {
        switchScreen('screen-court');
        prepareCourtroomSpecs();
    }, 1000);

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumberEl.innerText = count;

            // 💥 المرتين التاليتين: تشغيل الصوت مع ظهور رقم 2 ورقم 1
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

    if (btnChaosVote) {
        btnChaosVote.classList.add("hidden-element");
    }

    const caseTextEl = document.getElementById("court-case-text");
    const caseBoxEl = document.getElementById("court-case-box");
    const timerSectionEl = document.getElementById("court-timer-section");
    const speakersEl = document.getElementById("court-speakers");


    if (caseTextEl) {
        // 1️⃣ توليد القضية بالأسامي الحقيقية أوفلاين في الخلفية 🧠
        let finalCaseText = getRandomFormattedCase();

        // 2️⃣ نغذي الأنيميشن بالنص الجديد في الـ Attribute عشان يقرأ الأسامي الصح
        caseTextEl.setAttribute("data-target-case", finalCaseText);

        // 3️⃣ 💥 السر هنا: نفضي الشاشة تماماً عشان التأثير يبدأ يكتب من الصفر بدون وميض
        caseTextEl.innerText = "";
        caseTextEl.classList.remove("typing-done");
    }

    if (caseBoxEl) caseBoxEl.classList.remove("move-up");
    if (timerSectionEl) timerSectionEl.classList.add("hidden-element");

    // 🚀 إعادة تصفير البادج للشكل الافتراضي والهيكل الأصلي للمتحدثين
    if (speakersEl) {
        speakersEl.classList.add("hidden");
        speakersEl.style.background = "";
        speakersEl.innerHTML = `📢 المتحدثين بس يتكلمو `;
    }

    // 🚀 إزالة كلاسات الألوان وتصفير أي Stroke ملون يدويًا قديم
    const circleStroke = document.getElementById("timer-progress-circle");
    if (circleStroke) {
        circleStroke.removeAttribute("style");
    }

    // 🚀 التعديل الذكي لدعم اللعب بدون وقت 
    if (gameSettings.timeLimit === "unlimited") {
        totalDuration = 0;
        secondsLeft = 0;
    } else {
        totalDuration = Number(gameSettings.timeLimit) * 60;
        secondsLeft = totalDuration;
    }

    isTimerPaused = false;
    // 🔥 بنجبر الدائرة تاخد وضع الانفينيتي والدهبي فوراً هنا
    updateTimerCircleVisuals();
}

function startCourtroomTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);

    isZeroingSoundPlayed = false;
    isTimerDangerSoundPlayed = false;

    gameTimerInterval = setInterval(() => {
        if (!isTimerPaused) {

            // 🛑 [حالة بدون وقت - تصاعدي ♾️]
            if (gameSettings.timeLimit === "unlimited") {
                if (typeof secondsLeft !== "number") secondsLeft = 0;
                secondsLeft++; // العداد بيزيد تصاعدي
            }

            // ⏳ [الحالة العادية - تنازلي]
            else {
                secondsLeft--;
                const actualTimePassed = totalDuration - secondsLeft;

                const timerCircle = document.getElementById('timer-progress-circle');

                if (actualTimePassed >= 5) {
                    if (!isZeroingSoundPlayed) {
                        playGameSound(zeroingSound);
                        isZeroingSoundPlayed = true;
                    }
                }

                // لحظة الصفر للتنازلي
                if (secondsLeft <= 0) {
                    clearInterval(gameTimerInterval);

                    if (timerDangerSound) {
                        timerDangerSound.pause();
                        timerDangerSound.currentTime = 0;
                    }

                    playGameSound(whistleSound);

                    setTimeout(() => {
                        if (typeof startVotingPhase === "function") {
                            startVotingPhase();
                        }
                    }, 1000);
                }
            }

            // التحديث بيحصل هنا إجباري لكل الحالات كل ثانية
            updateTimerCircleVisuals();
            if (typeof spawnTimerParticles === "function") spawnTimerParticles();
        }
    }, 1000);
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

    if (isSoundEnabled && courtroomTypewriterSound) {
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
            if (courtroomTypewriterSound) {
                courtroomTypewriterSound.pause();
                courtroomTypewriterSound.currentTime = 0;
            }

            caseTextEl.classList.add("typing-done");


            // جوه دالة runCourtroomAction وتحديداً في الـ setTimeout الأخير بعد انتهاء الـ Typewriter:
            typewriterTimeout = setTimeout(() => {
                if (caseBoxEl) caseBoxEl.classList.add("move-up");

                if (timerSectionEl)
                    timerSectionEl.classList.remove("hidden-element");
                playGameSound(startSound);

                const btnChaosVote = document.getElementById("btn-chaos-vote");
                if (btnChaosVote)
                    btnChaosVote.classList.remove("hidden-element");

                // 🔥 البادج بستايل الـ VIP الجديد
                if (speakersEl) {
                    speakersEl.classList.remove("hidden");

                    // هنجيب الناس الـ VIP من المصفوفة
                    let vips = gameSettings.roles.filter(
                        r => r.roleTitle && r.roleTitle.includes('VIP')
                    );

                    if (vips.length === 1) {
                        speakersEl.innerHTML = ` الـ VIP : <span style="color: #ffcc00; font-weight: bold; text-shadow: 0 0 5px rgba(255,204,0,0.5);"> ${vips[0].name} </span>`;
                    } else if (vips.length >= 2) {
                        speakersEl.innerHTML = ` الـ VIP : &nbsp;<span style="color: #ffcc00; font-weight: bold;"> ${vips[0].name} </span> &nbsp;,&nbsp; <span style="color: #ffcc00; font-weight: bold;"> ${vips[1].name} </span>`;
                    } else {
                        speakersEl.innerHTML = `📢 ركّزوا مع الـ VIP!`;
                    }
                }

                startCourtroomTimer();
            }, 1500);
        }
    }
    typeWriter();
}

function updateTimerCircleVisuals() {
    const gameTimerEl = document.getElementById('game-timer');
    const circleStroke = document.getElementById("timer-progress-circle");

    if (gameSettings.timeLimit === "unlimited" || totalDuration === 0) {

        if (typeof secondsLeft !== "number") secondsLeft = 0;

        const min = Math.floor(secondsLeft / 60);
        const sec = secondsLeft % 60;

        if (gameTimerEl) {
            gameTimerEl.innerText =
                `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

            gameTimerEl.style.fontSize = "";
        }

        if (circleStroke) {
            circleStroke.style.setProperty('stroke-dashoffset', '0', 'important');
            circleStroke.style.setProperty('stroke', '#d4ac0d', 'important');
            circleStroke.classList.remove("danger", "warning", "chaos-mode");
        }

        return;
    }

    // ⏳ [الحالة العادية - التنازلي]
    if (gameTimerEl) {
        gameTimerEl.style.fontSize = "";
    }

    if (circleStroke) {
        circleStroke.style.removeProperty('stroke');

        if (typeof secondsLeft !== "number") return;

        let min = Math.floor(secondsLeft / 60);
        let sec = secondsLeft % 60;
        if (isNaN(min) || isNaN(sec)) { min = 0; sec = 0; }

        if (gameTimerEl) {
            gameTimerEl.innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        const percentageLeft = totalDuration > 0 ? (secondsLeft / totalDuration) : 0;
        const offset = 283 - (percentageLeft * 283);

        circleStroke.style.strokeDashoffset = offset;

        // 🎨 تغيير اللون حسب الوقت المتبقي
        if (secondsLeft <= 60) {
            // آخر دقيقة
            circleStroke.style.stroke = "#7d0c1a";
        }
        else if (percentageLeft <= 0.5) {
            // بعد نص الوقت
            circleStroke.style.stroke = "#e67e22";
        }
        else {
            // بداية الجيم
            circleStroke.style.stroke = "#d4ac0d";
        }
    }
}

function spawnTimerParticles() {
    const timerSectionEl = document.getElementById("court-timer-section");
    if (!timerSectionEl || timerSectionEl.classList.contains("hidden-element")) return;

    const container = document.getElementById("timer-particles-container");
    if (!container) return;

    const progressCircle = document.getElementById("timer-progress-circle");
    let particleColor = "#8e848e"; // الافتراضي

    // جوه دالة spawnTimerParticles عدل الشرط ده:
    if (progressCircle) {
        // 🎯 حط الشرط ده في الأول خالص فوق عشان يلقط الانفينيتي فوراً
        if (gameSettings.timeLimit === "unlimited" || totalDuration === 0) {
            particleColor = "#d4ac0d"; // الدهبي الرايق
        } else if (progressCircle.classList.contains("danger")) {
            particleColor = "#7d0c1a";
        } else if (progressCircle.classList.contains("warning")) {
            particleColor = "#e67e22";
        }
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

        setTimeout(() => {
            particle.remove();
        }, 900);
    }
}

// ==========================================================================
// 💥 متغيرات مود الفوضى الذكي (Chaos Mode) 
// ==========================================================================
let isChaosModeEnabled = true; // المفتاح الرئيسي (Toggle)
let chaosOrders = [];
let isChaosActive = false;
let chaosTimeLeft = 0;
let chaosInterval = null;

// الأوقات المحددة مسبقاً (للجيم المحدود بوقت فقط)
let guaranteedChaosTimes = [];

// مستمع الإعدادات لوضع الفوضى (Chaos Mode)
document.addEventListener("DOMContentLoaded", () => {
    const chaosToggle = document.getElementById("chaos-mode-toggle");

    if (chaosToggle) {
        // 1. خلى الـ Toggle يقف على الحالة الحالية للمتغير (سواء true أو false)
        chaosToggle.checked = isChaosModeEnabled;

        // 2. مستمع التغيير عند ضغط اللاعب
        chaosToggle.addEventListener("change", (e) => {
            isChaosModeEnabled = e.target.checked;

            // 3. تشغيل الصوت الحقيقي (بدون علامات تنصيص)
            if (typeof playGameSound === "function") {
                // شيلنا الـ Strings وباصينا الـ Audio Objects علطول بالمسطرة 🎯
                playGameSound(isChaosModeEnabled ? soundOn : soundOff);
            }

            console.log("⚙️ وضع الفوضى أصبح:", isChaosModeEnabled ? "مفعّل" : "ملغي");
        });
    }
});

// دالة تحميل الأوامر
async function loadChaosOrders() {
    try {
        const response = await fetch("chaos_orders.json");
        chaosOrders = await response.json();
        console.log("✅ تم تحميل أوامر الفوضى بنجاح، العدد:", chaosOrders.length);
    } catch (e) {
        console.error("❌ فشل تحميل أوامر الفوضى من الـ JSON:", e);
    }
}

// 🎯 دالة تشغيل الفوضى وتعديل النص للـ VIP
function triggerChaosMode() {
    if (chaosOrders.length === 0) {
        console.warn("⚠️ مفيش أوامر فوضى جاهزة للتشغيل!");
        return;
    }

    // 🔊 تشغيل صوت سرينة الفوضى الرعب
    playGameSound(zeroingSound);
    triggerGameVibrate([100, 100, 100, 100, 100, 100, 100, 100, 100]);


    isChaosActive = true;
    isTimerPaused = true; // ⏸️ إيقاف تايمر الجيم الرئيسي مؤقتاً عشان الفوضى متسرقش الوقت!

    // 1️⃣ اختار أمر عشوائي من مصفوفة الفوضى
    const randomIndex = Math.floor(Math.random() * chaosOrders.length);
    const selectedOrder = chaosOrders[randomIndex];
    let finalOrderText = selectedOrder.text;

    // 2️⃣ فلترة أسامي الـ VIP ديناميكياً من الأدوار المتخزنة
    let activeVips = [];
    if (gameSettings && Array.isArray(gameSettings.roles)) {
        activeVips = gameSettings.roles
            .filter(role => role.roleTitle === "VIP 🔥" && !role.isExpelled)
            .map(role => role.name);
    }

    // 3️⃣ لزق جملة الاستثناء لو فيه VIP في الماتش ده
    if (activeVips.length > 0) {
        const vipNamesText = activeVips.join(" و ");
        finalOrderText += ` ماعدا ${vipNamesText}`;
    }

    // 4️⃣ قفل النور على اللعبة وتفعيل كلاس الفوضى
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('chaos-dark-mode');
    document.body.classList.add("chaos-alert-active");

    // 5️⃣ ارمي النص المعدل جوة الكارت وافتح الأوفرلاي وشغل الأنيكيشن لو موجودة
    const orderTextEl = document.getElementById("chaos-order-text");
    if (orderTextEl) orderTextEl.innerText = finalOrderText;

    const chaosOverlay = document.getElementById("chaos-overlay");
    if (chaosOverlay) chaosOverlay.classList.remove("hidden-element");

    const chaosBox = document.getElementById("chaos-mode-box");
    if (chaosBox) chaosBox.classList.add("animate-chaos-pop");

    // 6️⃣ عداد الفوضى (التايمر التنازلي للكارت)
    chaosTimeLeft = selectedOrder.duration;
    const timerEl = document.getElementById("chaos-order-timer");
    if (timerEl) timerEl.innerText = chaosTimeLeft;

    if (chaosInterval) clearInterval(chaosInterval);

    chaosInterval = setInterval(() => {
        chaosTimeLeft--;
        if (timerEl) timerEl.innerText = chaosTimeLeft;

        if (chaosTimeLeft <= 0) {
            clearChaosUI();
        }
    }, 1000);
}

// 🧹 دالة مجمعة لتنظيف الشاشة وإعادة الجيم للوضع الطبيعي
function clearChaosUI() {
    if (chaosInterval) {
        clearInterval(chaosInterval);
        chaosInterval = null;
    }
    isChaosActive = false;
    isTimerPaused = false; // ▶️ استئناف الجيم الرئيسي بعد انتهاء الفوضى

    document.body.classList.remove("chaos-alert-active");

    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('chaos-dark-mode');

    const chaosOverlay = document.getElementById("chaos-overlay");
    const chaosBox = document.getElementById("chaos-mode-box");

    if (chaosOverlay) chaosOverlay.classList.add("hidden-element");
    if (chaosBox) chaosBox.classList.remove("animate-chaos-pop");
}

// دالة التايمر الرئيسي
async function startCourtroomTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);



    isZeroingSoundPlayed = false;
    isTimerDangerSoundPlayed = false;

    let secondsPassedInCourt = 0;
    guaranteedChaosTimes = [];

    // ننتظر شحن الأوامر تماماً قبل ما نتحرك خطوة واحدة
    if (chaosOrders.length === 0) {
        await loadChaosOrders();
    }

    // فحص الأمان الأول وجدولة الأوقات
    if (isChaosModeEnabled) {
        if (gameSettings.timeLimit !== "unlimited") {
            const totalSecs = Number(gameSettings.timeLimit) * 60;
            const calculatedEvents = (totalSecs <= 300) ? 1 : 2;

            for (let i = 0; i < calculatedEvents; i++) {
                const sectionStart = Math.floor((totalSecs / calculatedEvents) * i);
                const sectionEnd = Math.floor((totalSecs / calculatedEvents) * (i + 1));

                const safeStart = Math.max(sectionStart, 15);
                const safeEnd = Math.min(sectionEnd, totalSecs - 30);

                if (safeEnd > safeStart) {
                    guaranteedChaosTimes.push(
                        Math.floor(safeStart + Math.random() * (safeEnd - safeStart))
                    );
                }
            }
            console.log(`💣 جيم محدود بوقت. تم جدولة (${calculatedEvents}) أوامر فوضى عند الثواني:`, guaranteedChaosTimes);
        } else {
            console.log("♾️ جيم وقت مفتوح (Infinity). الفوضى ستعمل بنظام الدورات المتكررة.");
        }
    }

    gameTimerInterval = setInterval(() => {
        // لو التايمر معموله باوز (بسبب الفوضى مثلاً)، الـ interval هيرن بس مش هيعد ولا هيعمل حاجة
        if (!isTimerPaused) {
            secondsPassedInCourt++;

            if (gameSettings.timeLimit === "unlimited") {
                if (typeof secondsLeft !== "number") secondsLeft = 0;
                secondsLeft++;
            } else {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    clearInterval(gameTimerInterval);
                    clearChaosUI(); // أمان لو الجيم خلص وفيه بقايا فوضى
                    if (typeof startVotingPhase === "function") startVotingPhase();
                    return;
                }
            }

            // لوجيك تشغيل الفوضى مع فحص زر الأمان الصارم
            if (isChaosModeEnabled && !isChaosActive) {
                if (gameSettings.timeLimit !== "unlimited") {
                    if (guaranteedChaosTimes.includes(secondsPassedInCourt)) {
                        triggerChaosMode();
                    }
                } else {
                    if (secondsPassedInCourt > 30) {
                        if (Math.random() < 0.006) {
                            triggerChaosMode();
                        }
                    }
                }
            }

            if (typeof updateTimerCircleVisuals === "function") updateTimerCircleVisuals();
            if (typeof spawnTimerParticles === "function") spawnTimerParticles();
        }
    }, 1000);
}








// ==========================================================================
// 🛡️ المنظومة الموحدة والوحيدة للتحكم في مودال الاعتراض والتايمر (بدون تكرار)
// ==========================================================================

// 🚀 دالة إغلاق المودال برمجياً وفك تجميد الوقت فوراً
function closeObjectionModalAndResume() {
    const modal = document.getElementById('objection-modal');
    if (modal) {
        modal.classList.add('hidden'); // يقفل الكارت بالترنزيشن الناعم والـ CSS

        // فك تجميد الساعة فوراً بناءً على متغير السيستم بتاعك
        isTimerPaused = false;
        console.log("🔓 تم فك تجميد وقت المحكمة بنجاح وبدأت الساعة تعد!");
    }
}

// 🚀 دالة فتح المودال وتجميد الوقت مؤقتاً
function openObjectionModal() {
    const modal = document.getElementById('objection-modal');
    if (modal) {
        modal.classList.remove('hidden'); // يظهر بـ Pop Effect ناعم

        // جمد الساعة فوراً طول ما هما بيتناقشوا في الطرد
        isTimerPaused = true;
        console.log("🔒 تم تجميد وقت المحكمة مؤقتاً للاعتراض!");
    }
}

// 🎯 1. لقطة الضغط بره الكارت (مباشرة وآمنة على الأي دي الفعلي للمودال)
if (document.getElementById('objection-modal')) {
    document.getElementById('objection-modal').addEventListener('click', function (e) {
        // بنشيك لو صباع اللاعب لمس الخلفية المظلمة بره حدود الكارت نفسه
        if (e.target === this) {
            closeObjectionModalAndResume();
        }
    });
}

// 🎯 2. زرار الـ (X) الصغير اللي جوه الكارت
if (document.getElementById('close-objection-modal')) {
    document.getElementById('close-objection-modal').onclick = function (e) {
        e.preventDefault();
        e.stopPropagation(); // منع تداخل الأحداث
        closeObjectionModalAndResume();
    };
}

let votingIndex = 0;
let caughtPlayerIndex = null;
let selectedSpierIndex = null;
let isChallengeRevealed = false;
let isConfrontationMode = false;

// ==========================================================================
// 1. بدء مرحلة التصويت
// ==========================================================================
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

// ==========================================================================
// 2. تجهيز وعرض كارت اللاعب الحالي (نسخة محصنة ضد الـ Spam 🛡️)
// ==========================================================================
function showPlayerVoteCard() {
    // 🚨 تخطي اللاعبين المطرودين بـ Loop واضحة بدل الـ Recursion اللي كان ممكن يضرب الـ Stack
    while (gameSettings && gameSettings.roles && votingIndex < gameSettings.roles.length) {
        const currentVoteData = gameSettings.roles[votingIndex];
        const originalPlayer = players.find(p => p.name === currentVoteData.name);

        if (originalPlayer && originalPlayer.isDead) {
            votingIndex++; // تخطي المطرود وادخل على اللي بعده
        } else {
            break; // لو لاعب صاحي اخرج من الـ Loop وكمل طبيعي
        }
    }

    // لو وصلنا لآخر اللاعبين، اعرض مودال نهاية الجولة
    if (!gameSettings || !gameSettings.roles || votingIndex >= gameSettings.roles.length) {
        showRoundEndChoiceModal();
        return;
    }

    const currentVoteData = gameSettings.roles[votingIndex];

    // إعادة ضبط الفلاجات
    isChallengeRevealed = false;
    isConfrontationMode = false;

    // إظهار الـ gate والـ master-reveal
    const gate = document.getElementById('neon-gate');
    if (gate) gate.style.display = 'flex';

    const masterReveal = document.getElementById('btn-master-reveal');
    if (masterReveal) masterReveal.style.display = 'flex';

    // إظهار عناصر الدور العادي
    document.getElementById('initial-actions-group').style.display = 'flex';
    document.getElementById('verify-actions-group').style.display = 'none';

    const judgeGrid = document.getElementById('judge-options-grid');
    if (judgeGrid) judgeGrid.style.display = 'none';

    // مسك عناصر الأزرار لتسهيل حمايتها وتفعيلها مجدداً
    const btnVoteFailedInit = document.getElementById('btn-vote-failed-init');
    const btnVoteSuccessInit = document.getElementById('btn-vote-success-init');
    const btnVoteCaught = document.getElementById('btn-vote-caught');
    const btnVerifyTrue = document.getElementById('btn-verify-true');
    const btnVerifyFalse = document.getElementById('btn-verify-false');

    // 🚨 فك تعطيل كل الأزرار مع بداية دور أي لاعب جديد (عشان نضمن إنها جاهزة للضغط)
    if (btnVoteFailedInit) btnVoteFailedInit.disabled = false;
    if (btnVoteSuccessInit) btnVoteSuccessInit.disabled = false;
    if (btnVoteCaught) btnVoteCaught.disabled = false;
    if (btnVerifyTrue) btnVerifyTrue.disabled = false;
    if (btnVerifyFalse) btnVerifyFalse.disabled = false;

    // 🚨 دالة الحماية المركزية: بتعطل كل أزرار التصويت فوراً لمنع السبام والضغط المزدوج
    function disableAllVoteButtons() {
        if (btnVoteFailedInit) btnVoteFailedInit.disabled = true;
        if (btnVoteSuccessInit) btnVoteSuccessInit.disabled = true;
        if (btnVoteCaught) btnVoteCaught.disabled = true;
        if (btnVerifyTrue) btnVerifyTrue.disabled = true;
        if (btnVerifyFalse) btnVerifyFalse.disabled = true;
    }

    // 🚨 التحكم في زرار الشك بناءً على وضع المتخصص
    if (btnVoteCaught) {
        if (isSpecialistModeActive) {
            btnVoteCaught.style.setProperty('display', 'none', 'important'); // إخفاء زرار الشك تماماً
            console.log("🤫 وضع المتخصص نشط: تم إخفاء زرار الشك (قفشته) من جولة التصويت.");
        } else {
            btnVoteCaught.style.setProperty('display', 'block', 'important'); // إظهاره طبيعي في المود العادي
        }
    }

    // تحديث النص
    const votingTargetEl = document.getElementById('voting-target-player');
    if (votingTargetEl) {
        votingTargetEl.style.opacity = '1';
        votingTargetEl.innerHTML = `يا <span style="color:#ff4757; font-size:1.4rem; font-weight:bold;">${currentVoteData.name}</span> نفذت تحديك؟`;
    }

    // غلق البوابة
    if (gate) {
        gate.classList.remove('gate-open');
        gate.classList.add('gate-closed');
    }

    // نص التحدي
    const challengeTextEl = document.getElementById('challenge-text-placeholder');
    if (challengeTextEl) {
        challengeTextEl.innerText = `${currentVoteData.challengeText || currentVoteData.secretChallenge}`;
    }

    // --- برمجة الأزرار العادية مع إضافة الأصوات والحماية ضد الـ Double-Click 🔊 ---

    // ✅ زرار "منفذتوش" - مفيش نقاط
    if (btnVoteFailedInit) {
        btnVoteFailedInit.onclick = function () {
            if (this.disabled) return; // حماية إضافية
            disableAllVoteButtons(); // 🛡️ قفل فوري للحنفية ومستحيل ينداس تاني
            playGameSound(clickSound);

            handleArcadeVoteSlam(() => {
                nextVoteRound();
            });
        };
    }

    // ✅ زرار "نفذته" - إضافة نقطة للاعب
    if (btnVoteSuccessInit) {
        btnVoteSuccessInit.onclick = function () {
            if (this.disabled) return; // حماية إضافية
            disableAllVoteButtons(); // 🛡️ قفل فوري للحنفية ومستحيل ينداس تاني
            playGameSound(clickSound);

            const pIdx = players.findIndex(p => p.name === currentVoteData.name);
            if (pIdx !== -1) {
                players[pIdx].score += 1;
                console.log(`✅ ${currentVoteData.name} كسب نقطة! المجموع: ${players[pIdx].score}`);
            }

            handleArcadeVoteSlam(() => {
                nextVoteRound();
            });
        };
    }

    // حماية الزرار برمجياً عند الشك
    if (btnVoteCaught) {
        btnVoteCaught.onclick = function () {
            if (this.disabled) return;
            if (isSpecialistModeActive) return;
            if (isChallengeRevealed) return;

            disableAllVoteButtons(); // 🛡️ عطل الأزرار عشان محدش يدوس تآني أثناء فتح المودال
            playGameSound(clickSound);
            isConfrontationMode = true;
            caughtPlayerIndex = votingIndex;
            openSpierSelectionModal();
        };
    }

    // إعادة النصوص الأصلية للأزرار
    // (لو حبيت ترجع النصوص الافتراضية حطها هنا)

    // ✅ أزرار التحقق - إضافة نقاط صح
    if (btnVerifyTrue) {
        btnVerifyTrue.onclick = function () {
            if (this.disabled) return;
            disableAllVoteButtons(); // 🛡️ قفل فوري للحنفية
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
            disableAllVoteButtons(); // 🛡️ قفل فوري للحنفية
            playGameSound(clickSound);

            handleArcadeVoteSlam(() => {
                nextVoteRound();
            });
        };
    }
}

// ==========================================================================
// 3. مودال اختيار: جولة كمان ولا النتائج؟ (النسخة المتصلحة)
// ==========================================================================
function showRoundEndChoiceModal() {
    triggerGameVibrate([80, 150, 80]);

    // إخفاء الكارت والعين (شغلك القديم المضمون)
    const gate = document.getElementById('neon-gate');
    if (gate) gate.style.display = 'none';

    const masterReveal = document.getElementById('btn-master-reveal');
    if (masterReveal) masterReveal.style.display = 'none';

    document.getElementById('initial-actions-group').style.display = 'none';
    document.getElementById('verify-actions-group').style.display = 'none';

    const btnVoteCaught = document.getElementById('btn-vote-caught');
    if (btnVoteCaught) btnVoteCaught.style.display = 'none';

    const judgeGrid = document.getElementById('judge-options-grid');
    if (judgeGrid) judgeGrid.style.display = 'none';

    // إظهار مجموعة الأزرار (الـ CSS هيحولها لبوب أب رعب في النص)
    const roundEndGroup = document.getElementById('round-end-actions-group');
    if (roundEndGroup) {
        roundEndGroup.style.display = 'grid';
    }

    // ربط الأزرار بالـ Slam القديم اللي شغال معاك مية مية
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

// ==========================================================================
// 4. بدء جولة جديدة (نفس تأثير زرار "جاهزين" في اللوبي)
// ==========================================================================
function startNextGameRound() {
    console.log("🔄 جاري بدء جولة جديدة...");

    votingIndex = 0;
    isChallengeRevealed = false;
    isConfrontationMode = false;

    players.forEach(p => {
        p.isDead = false;
    });

    gameSettings.roles = [];
    currentRoleIndex = 0;

    if (typeof startRolesDistribution === "function") {
        startRolesDistribution();
    } else {
        playGameSound(errorSound); // 🔊 صوت الخطأ المركزي لو الدالة مش موجودة
        console.error("❌ دالة startRolesDistribution مش موجودة!");
        showCustomToast("⚠️ حصل مشكلة في بدء الجولة الجديدة");
    }

    if (typeof saveLobbyPlayers === "function") saveLobbyPlayers();

    playGameSound(alertSound); // 🔊 صوت التنبيه لبدء الجولة الجديدة
    showCustomToast("🔥 بدأت جولة جديدة! تحديات جديدة!");
}

// ==========================================================================
// 5. دالة خبطة الأزرار الأركيدية
// ==========================================================================
function handleArcadeVoteSlam(callback) {
    const gate = document.getElementById('neon-gate');
    if (!gate) {
        if (callback) callback();
        return;
    }

    gate.classList.add('guillotine-slam-animation');
    setTimeout(() => {
        gate.classList.remove('guillotine-slam-animation');
        if (callback) callback();
    }, 300);
}

// ==========================================================================
// 6. دالة الانتقال الذكية بأنيميشن النزول والطلوع الفخم 🔥 (تم تنظيف التكرار بالكامل)
// ==========================================================================
function nextVoteRound() {
    if (typeof saveLobbyPlayers === "function") saveLobbyPlayers();

    const gate = document.getElementById('neon-gate');
    const announcer = document.getElementById('voting-target-player');

    if (gate) {
        playGameSound(swipeSound); // 🔊 تشغيل صوت السوايب/الانتقال بين الكروت

        // 1. الكارت الحالي ينزل لتحت ويختفي
        gate.classList.add('slide-out');
        if (announcer) announcer.style.opacity = '0';

        setTimeout(() => {
            votingIndex++;

            // تجهيز الداتا الجديدة جوة الكارت وهو مخفي
            showPlayerVoteCard();

            // 2. الكارت الجديد ينزل من فوق بشكل سريع وانسيابي
            gate.classList.remove('slide-out');
            gate.classList.add('slide-in');

            setTimeout(() => {
                gate.classList.remove('slide-in'); // تنظيف الكلاس بعد الأنيميشن
            }, 250);

        }, 200); // وقت اختفاء الكارت القديم
    } else {
        votingIndex++;
        showPlayerVoteCard();
    }
}

// ==========================================================================
// 7. زرار العين (كشف التحدي)
// ==========================================================================
const btnMasterReveal = document.getElementById('btn-master-reveal');
if (btnMasterReveal) {
    btnMasterReveal.onclick = function () {
        isChallengeRevealed = true;

        playGameSound(swipeSound); // 🔊 تشغيل صوت السوايب هنا مباشرة عند الضغط على العين

        const gate = document.getElementById('neon-gate');
        if (gate) {
            gate.classList.remove('gate-closed');
            gate.classList.add('gate-open');
        }

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
            if (votingTargetEl) {
                votingTargetEl.innerHTML = `شوفو التحدي! هل نفذه وقالو صح?`;
            }
        }
    };
}

// ==========================================================================
// 🕵️‍♂️ سيستم المواجهة والشك
// ==========================================================================
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
            if (targetContainer) {
                targetContainer.appendChild(cancelBtn);
            } else {
                modal.appendChild(cancelBtn);
            }
        }
    }

    cancelBtn.onclick = function (e) {
        e.preventDefault();
        playGameSound(clickSound); // 🔊 صوت كليك عند التراجع
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
                playGameSound(clickSound); // 🔊 صوت كليك عند اختيار الشخص اللي شك

                const radio = card.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    if (nextBtn) nextBtn.disabled = false;
                }
            });
            grid.appendChild(card);
        });
    }

    if (nextBtn) {
        nextBtn.onclick = function (e) {
            e.preventDefault();
            playGameSound(clickSound); // 🔊 صوت كليك للتأكيد
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
    if (votingTargetEl) {
        votingTargetEl.innerHTML = `هل تخمين <span style="color:#e67e22; font-weight:900;">${spierName}</span> طلع صح ومطابق؟`;
    }

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
        <button class="arcade-btn arcade-success" id="btn-judge-correct">
            <span class="btn-top">شك صح +1</span>
        </button>
        <button class="arcade-btn arcade-failed" id="btn-judge-wrong">
            <span class="btn-top">شك غلط -1</span>
        </button>
    `;

    document.getElementById('btn-judge-correct').onclick = function () {
        playGameSound(clickSound); // 🔊 صوت كليك الحكم
        handleArcadeVoteSlam(() => {
            players[selectedSpierIndex].score += 1;
            finalizeConfrontationRound();
        });
    };

    document.getElementById('btn-judge-wrong').onclick = function () {
        playGameSound(clickSound); // 🔊 صوت كليك الحكم
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

// 🔥 دالة الانتقال الذكية بأنيميشن النزول والطلوع الفخم 🔥
function nextVoteRound() {
    if (typeof saveLobbyPlayers === "function") saveLobbyPlayers();

    const gate = document.getElementById('neon-gate');
    const announcer = document.getElementById('voting-target-player');

    if (gate) {
        // 1. الكارت الحالي ينزل لتحت ويختفي
        gate.classList.add('slide-out');
        if (announcer) announcer.style.opacity = '0';

        setTimeout(() => {
            votingIndex++;

            // تجهيز الداتا الجديدة جوة الكارت وهو مخفي
            showPlayerVoteCard();

            // 2. الكارت الجديد ينزل من فوق بشكل سريع وانسيابي
            gate.classList.remove('slide-out');
            gate.classList.add('slide-in');

            setTimeout(() => {
                gate.classList.remove('slide-in'); // تنظيف الكلاس بعد الأنيميشن
            }, 250);

        }, 200); // وقت اختفاء الكارت القديم
    } else {
        votingIndex++;
        showPlayerVoteCard();
    }
}

function showFinalResults() {
    // 💥 الانتقال لشاشة النتائج
    switchScreen('screen-results');

    // 💥 السطر السحري: تشغيل صوت الانتصار والتتويج فوراً أول ما الشاشة تظهر
    // الدالة المركزية بتشيك تلقائياً لو اللاعب مش عامل كتم للصوت
    playGameSound(victorySound);
    triggerGameVibrate([70, 60, 70, 60, 300]);

    const podiumDock = document.getElementById('podium-top3-dock');
    const runnersList = document.getElementById('results-runners-list');

    if (!podiumDock || !runnersList) return;

    podiumDock.innerHTML = '';
    runnersList.innerHTML = '';

    // 🔥 الترتيب الذكي: النقاط أولاً، ثم أبجدياً لو في تعادل
    let sorted = [...players].sort((a, b) => {
        // 1️⃣ رتب حسب النقاط (الأكبر فوق)
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        // 2️⃣ لو النقاط متساوية، رتب أبجدياً بالعربي
        return a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' });
    });

    // فصل الثلاثة الأوائل عن بقية اللاعبين
    let top3 = sorted.slice(0, 3);
    let runners = sorted.slice(3);

    // 🛠️ إعادة ترتيب الثلاثة الأوائل في العرض
    let orderedTop3 = [];
    if (top3[1]) orderedTop3.push({ p: top3[1], r: 2, textRank: 'الثاني', badge: '🥈', color: '#c0c0c0' });
    if (top3[0]) orderedTop3.push({ p: top3[0], r: 1, textRank: 'الأول', badge: '👑', color: '#ffd700' });
    if (top3[2]) orderedTop3.push({ p: top3[2], r: 3, textRank: 'الثالث', badge: '🥉', color: '#cd7f32' });

    // 1. بناء منصة التتويج الثلاثية النظيفة
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

    // 2. بناء كروت باقي اللاعبين والمطرودين
    runners.forEach((player, idx) => {
        const actualRank = idx + 4; // بيبدأ من المركز الرابع

        let cardClass = 'runner-cyber-strip';
        if (player.isDead) {
            cardClass += ' strip-player-expelled';
        }

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
// 🔟 إدارة الشاشات والتنقل (Screen Router)
// ==========================================================================
function switchScreen(screenId) {
    const appContainer = document.querySelector('.app-container');
    if (!appContainer) return;

    if (screenId === 'screen-lobby') {
        appContainer.classList.add('lobby-active');
        appContainer.classList.remove('screen-roles-active');
    }
    else if (screenId === 'screen-roles') {
        appContainer.classList.add('screen-roles-active');
        appContainer.classList.remove('lobby-active');
    }
    else {
        appContainer.classList.remove('lobby-active', 'screen-roles-active');
    }

    document.querySelectorAll('.game-screen').forEach(s => {
        s.classList.add('hidden');
    });

    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ==========================================================================
// 🔄 كود السحب الذكي الشغال في المقفول والمفتوح ( اللوبي )
// ==========================================================================
const lobbyBackBox = document.getElementById('lobbyBackBox');
const btnBackToMain = document.getElementById('btn-back-to-main');

window.addEventListener('load', () => {
    lobbyBackBox.classList.add('loaded');
});

function openBackBox(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    lobbyBackBox.classList.add('open');
}

function closeBackBox() {
    lobbyBackBox.classList.remove('open');
}

// الفتح عند ضغط المربع وهو مقفول (بشرط ميكونش بيسحب)
let isLobbyDragging = false;
lobbyBackBox.addEventListener('click', (e) => {
    if (isLobbyDragging) return; // لو كان بيسحب ميتعتبرش ضغطة فتح
    if (!lobbyBackBox.classList.contains('open')) {
        openBackBox(e);
    }
});

// الرجوع عند ضغط الزر الفعلي وهو مفتوح (بشرط ميكونش بيسحب)
btnBackToMain.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isLobbyDragging) return; // لو بيسحب ميرجعش فجأة
    console.log('العودة إلى القائمة الرئيسية...');
    closeBackBox();
});

// الغلق عند الضغط خارجاً
document.addEventListener('click', (e) => {
    if (
        lobbyBackBox.classList.contains('open') &&
        !lobbyBackBox.contains(e.target) &&
        !isLobbyDragging
    ) {
        closeBackBox();
    }
});

let isLobbyPointerDown = false;
let lobbyStartY = 0;
let lobbyStartTop = 25;

// دالة التحريك العمودية الآمنة مع حواف الشاشة
function handleLobbyPointerMove(currentY) {
    if (!isLobbyPointerDown) return;

    let newTop = lobbyStartTop + (currentY - lobbyStartY);

    // حدود الأمان: منع الزرار يطير بره حواف الشاشة فوق وتحت
    const elementHeight = lobbyBackBox.offsetHeight || 50;
    const maxTop = window.innerHeight - elementHeight - 15; // 15px أمان تحت
    const minTop = 15; // 15px أمان فوق

    if (newTop < minTop) newTop = minTop;
    if (newTop > maxTop) newTop = maxTop;

    lobbyBackBox.style.top = `${newTop}px`;
}

// --- 📱 دعم الموبايل (Touch) ---
lobbyBackBox.addEventListener('touchstart', (e) => {
    isLobbyPointerDown = true;
    isLobbyDragging = false;
    lobbyStartY = e.touches[0].clientY;
    lobbyStartTop = parseInt(window.getComputedStyle(lobbyBackBox).top, 10) || 25;
}, { passive: true });

lobbyBackBox.addEventListener('touchmove', (e) => {
    if (!isLobbyPointerDown) return;

    // لو اتحرك أكتر من 4 بكسل نعتبره سحب حقيقي ونمنع الـ Click
    if (Math.abs(e.touches[0].clientY - lobbyStartY) > 4) {
        isLobbyDragging = true;
    }
    handleLobbyPointerMove(e.touches[0].clientY);
}, { passive: true });

lobbyBackBox.addEventListener('touchend', () => {
    isLobbyPointerDown = false;
    setTimeout(() => { isLobbyDragging = false; }, 80);
});

// --- 💻 دعم الكمبيوتر (Mouse) ---
lobbyBackBox.addEventListener('mousedown', (e) => {
    isLobbyPointerDown = true;
    isLobbyDragging = false;
    lobbyStartY = e.clientY;
    lobbyStartTop = parseInt(window.getComputedStyle(lobbyBackBox).top, 10) || 25;
});

window.addEventListener('mousemove', (e) => {
    if (!isLobbyPointerDown) return;
    if (Math.abs(e.clientY - lobbyStartY) > 4) {
        isLobbyDragging = true;
    }
    handleLobbyPointerMove(e.clientY);
});

window.addEventListener('mouseup', () => {
    isLobbyPointerDown = false;
    setTimeout(() => { isLobbyDragging = false; }, 80);
});

// ==========================================================================
// 🔄 كود السحب الذكي الشغال في المقفول والمفتوح ( الاعدادات )
// ==========================================================================
const SettingBackBox = document.getElementById('SettingBackBox');
const btnBackFromSettings = document.getElementById('btn-back-from-settings');

window.addEventListener('load', () => {
    SettingBackBox.classList.add('loaded');
});

function openSettingsBox(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    SettingBackBox.classList.add('open');
}

function closeSettingsBox() {
    SettingBackBox.classList.remove('open');
}

// الفتح عند ضغط المربع وهو مقفول (بدون سحب)
let isDragging = false;
SettingBackBox.addEventListener('click', (e) => {
    if (isDragging) return; // لو كان بيسحب ميتعتبرش ضغطة فتح
    if (!SettingBackBox.classList.contains('open')) {
        openSettingsBox(e);
    }
});

// الرجوع عند ضغط الزر الفعلي وهو مفتوح (بشرط ميكونش بيسحب)
btnBackFromSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isDragging) return; // لو بيسحب لفوق وتحت ميرجعش للقائمة
    console.log('العودة من الإعدادات إلى القائمة الرئيسية...');
    closeSettingsBox();
});

// الغلق عند الضغط خارجاً
document.addEventListener('click', (e) => {
    if (
        SettingBackBox.classList.contains('open') &&
        !SettingBackBox.contains(e.target) &&
        !isDragging
    ) {
        closeSettingsBox();
    }
});

let isPointerDown = false;
let startY = 0;
let startTop = 25;

// دالة التحريك الحسابية الآمنة
function handlePointerMove(currentY) {
    if (!isPointerDown) return;

    // حساب المسافة الجديدة للـ Top
    let newTop = startTop + (currentY - startY);

    // حدود الأمان: تمنع الزرار يخرج بره حواف الشاشة فوق أو تحت
    const elementHeight = SettingBackBox.offsetHeight || 50;
    const maxTop = window.innerHeight - elementHeight - 15; // 15px أمان تحت
    const minTop = 15; // 15px أمان فوق

    if (newTop < minTop) newTop = minTop;
    if (newTop > maxTop) newTop = maxTop;

    // تطبيق الحركة على المحور العمودي Y وتثبيته على الحافة
    SettingBackBox.style.top = `${newTop}px`;
}

SettingBackBox.addEventListener('touchstart', (e) => {
    isPointerDown = true;
    isDragging = false;
    startY = e.touches[0].clientY;
    startTop = parseInt(window.getComputedStyle(SettingBackBox).top, 10) || 25;
}, { passive: true });

SettingBackBox.addEventListener('touchmove', (e) => {
    if (!isPointerDown) return;

    // إذا تحرك المستخدم أكتر من 4 بكسل نعتبره سحب حقيقي ونمنع الكليك
    if (Math.abs(e.touches[0].clientY - startY) > 4) {
        isDragging = true;
    }
    handlePointerMove(e.touches[0].clientY);
}, { passive: true });

SettingBackBox.addEventListener('touchend', (e) => {
    isPointerDown = false;
    // مهلة زمنية صغيرة جداً لتصفير السحب عشان الأوامر متتداخلش
    setTimeout(() => { isDragging = false; }, 80);
});

// --- 💻 دعم الكمبيوتر (Mouse) ---
SettingBackBox.addEventListener('mousedown', (e) => {
    isPointerDown = true;
    isDragging = false;
    startY = e.clientY;
    startTop = parseInt(window.getComputedStyle(SettingBackBox).top, 10) || 25;
});

window.addEventListener('mousemove', (e) => {
    if (!isPointerDown) return;
    if (Math.abs(e.clientY - startY) > 4) {
        isDragging = true;
    }
    handlePointerMove(e.clientY);
});

window.addEventListener('mouseup', () => {
    isPointerDown = false;
    setTimeout(() => { isDragging = false; }, 80);
});


// ==========================================================================
// 🔄 كود السحب الذكي لشاشة المحكمة (الجيم من جوا)
// ==========================================================================
const courtBackBox = document.getElementById('courtBackBox');
const courtBackBtn = document.getElementById('court-back-btn');

// إضافة كلاس الـ Loaded للظهور الناعم عند تحميل الصفحة
window.addEventListener('load', () => {
    courtBackBox.classList.add('loaded');
});

// دالة الفتح
function openCourtBackBox(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    courtBackBox.classList.add('open');
}

// دالة القفل
function closeCourtBackBox() {
    courtBackBox.classList.remove('open');
}

/* 1️⃣ عند ضغط المربع الخارجي وهو مقفول -> يفتح فوراً (بشرط ميكونش بيسحب) */
let isCourtDragging = false;
courtBackBox.addEventListener('click', (e) => {
    if (isCourtDragging) return; // لو كان بيسحب ميتعتبرش ضغطة فتح
    if (!courtBackBox.classList.contains('open')) {
        openCourtBackBox(e);
    }
});

/* 2️⃣ عند ضغط زرار الرجوع الفعلي وهو مفتوح -> ينفذ العودة (بشرط ميكونش بيسحب) */
courtBackBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isCourtDragging) return; // لو بيسحب لفوق وتحت ميرجعش فجأة

    // 👈 كود الرجوع بتاعك لشاشة القاضي/المحكمة السابقة هنا
    console.log('العودة من شاشة المحكمة...');

    closeCourtBackBox();
});

/* 3️⃣ اللمس في أي مكان برة المربع يقفله تلقائي */
document.addEventListener('click', (e) => {
    if (
        courtBackBox.classList.contains('open') &&
        !courtBackBox.contains(e.target) &&
        !isCourtDragging
    ) {
        closeCourtBackBox();
    }
});

let isCourtPointerDown = false;
let courtStartY = 0;
let courtStartTop = 25;

// دالة التحريك العمودية الآمنة لضمان بقائه داخل حدود الشاشة
function handleCourtPointerMove(currentY) {
    if (!isCourtPointerDown) return;

    let newTop = courtStartTop + (currentY - courtStartY);

    // حدود الأمان: منع الزرار يطير بره حواف الشاشة فوق وتحت
    const elementHeight = courtBackBox.offsetHeight || 50;
    const maxTop = window.innerHeight - elementHeight - 15; // 15px أمان تحت
    const minTop = 15; // 15px أمان فوق

    if (newTop < minTop) newTop = minTop;
    if (newTop > maxTop) newTop = maxTop;

    courtBackBox.style.top = `${newTop}px`;
}

// --- 📱 دعم الموبايل (Touch) ---
courtBackBox.addEventListener('touchstart', (e) => {
    isCourtPointerDown = true;
    isCourtDragging = false;
    courtStartY = e.touches[0].clientY;
    courtStartTop = parseInt(window.getComputedStyle(courtBackBox).top, 10) || 25;
}, { passive: true });

courtBackBox.addEventListener('touchmove', (e) => {
    if (!isCourtPointerDown) return;

    // لو المسافة العمودية المقطوعة أكبر من 4 بكسل، يتم اعتباره سحب حقيقي وإلغاء الـ Click
    if (Math.abs(e.touches[0].clientY - courtStartY) > 4) {
        isCourtDragging = true;
    }
    handleCourtPointerMove(e.touches[0].clientY);
}, { passive: true });

courtBackBox.addEventListener('touchend', () => {
    isCourtPointerDown = false;
    // مهلة زمنية صغيرة لتصفير السحب لضمان عدم حدوث تداخلات بالخطأ
    setTimeout(() => { isCourtDragging = false; }, 80);
});

// --- 💻 دعم الكمبيوتر (Mouse) لتسهيل التجربة في الـ Inspect ---
courtBackBox.addEventListener('mousedown', (e) => {
    isCourtPointerDown = true;
    isCourtDragging = false;
    courtStartY = e.clientY;
    courtStartTop = parseInt(window.getComputedStyle(courtBackBox).top, 10) || 25;
});

window.addEventListener('mousemove', (e) => {
    if (!isCourtPointerDown) return;
    if (Math.abs(e.clientY - courtStartY) > 4) {
        isCourtDragging = true;
    }
    handleCourtPointerMove(e.clientY);
});

window.addEventListener('mouseup', () => {
    isCourtPointerDown = false;
    setTimeout(() => { isCourtDragging = false; }, 80);
});


document.addEventListener('DOMContentLoaded', () => {
    const specialistBackBox = document.getElementById('specialistBackBox');
    const btnBackSpecialistToLobby = document.getElementById('btn-back-specialist-to-lobby');

    if (specialistBackBox && btnBackSpecialistToLobby) {

        // دالة الفتح
        function openSpecialistBox(e) {
            if (e && e.stopPropagation) e.stopPropagation();
            specialistBackBox.classList.add('open');
            console.log("تم فتح سلايدر المتخصص.");
        }

        // دالة القفل
        function closeSpecialistBox() {
            specialistBackBox.classList.remove('open');
        }

        /* 1️⃣ عند ضغط المربع الخارجي وهو مقفول -> يفتح فوراً (بشرط ميكونش بيسحب) */
        let isSpecDragging = false;
        specialistBackBox.addEventListener('click', (e) => {
            if (isSpecDragging) return; // لو كان بيسحب ميتعتبرش ضغطة فتح
            if (!specialistBackBox.classList.contains('open')) {
                openSpecialistBox(e);
            }
        });

        /* 2️⃣ عند ضغط زرار الرجوع الفعلي وهو مفتوح -> ينفذ العودة للوبي */
        btnBackSpecialistToLobby.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isSpecDragging) return;

            console.log('العودة من مود المتخصص إلى اللوبي...');

            // 🚀 السحر هنا: بنصفر كل التحديات والإنبوتات عشان المرة الجاية تفتح طلقة ونظيفة
            resetSpecialistModeState();

            // 👈 تحويل الشاشة فوراً للوبي الرئيسي
            if (typeof switchScreen === "function") {
                switchScreen('screen-lobby');
            }

            // إغلاق بوكس المتخصص (الأنميشن أو السلايدر الخاص بك)
            closeSpecialistBox();
        });

        /* 3️⃣ اللمس في أي مكان برة المربع يقفله تلقائي */
        document.addEventListener('click', (e) => {
            if (
                specialistBackBox.classList.contains('open') &&
                !specialistBackBox.contains(e.target) &&
                !isSpecDragging
            ) {
                closeSpecialistBox();
            }
        });

        // ==========================================================================
        // 🔄 كود السحب الذكي لشاشة المتخصص (فوق وتحت فقط في المفتوح والمقفول)
        // ==========================================================================
        let isSpecPointerDown = false;
        let specStartY = 0;
        let specStartTop = 25;

        // دالة التحريك العمودية الآمنة لضمان بقائه داخل حدود الشاشة
        function handleSpecPointerMove(currentY) {
            if (!isSpecPointerDown) return;

            let newTop = specStartTop + (currentY - specStartY);

            // حدود الأمان: منع الزرار يطير بره حواف الشاشة فوق وتحت
            const elementHeight = specialistBackBox.offsetHeight || 50;
            const maxTop = window.innerHeight - elementHeight - 15; // 15px أمان تحت
            const minTop = 15; // 15px أمان فوق

            if (newTop < minTop) newTop = minTop;
            if (newTop > maxTop) newTop = maxTop;

            specialistBackBox.style.top = `${newTop}px`;
        }

        // --- 📱 دعم الموبايل (Touch) ---
        specialistBackBox.addEventListener('touchstart', (e) => {
            isSpecPointerDown = true;
            isSpecDragging = false;
            specStartY = e.touches[0].clientY;
            specStartTop = parseInt(window.getComputedStyle(specialistBackBox).top, 10) || 25;
        }, { passive: true });

        specialistBackBox.addEventListener('touchmove', (e) => {
            if (!isSpecPointerDown) return;

            // لو المسافة العمودية المقطوعة أكبر من 4 بكسل، يتم اعتباره سحب حقيقي وإلغاء الـ Click
            if (Math.abs(e.touches[0].clientY - specStartY) > 4) {
                isSpecDragging = true;
            }
            handleSpecPointerMove(e.touches[0].clientY);
        }, { passive: true });

        specialistBackBox.addEventListener('touchend', () => {
            isSpecPointerDown = false;
            // مهلة زمنية صغيرة لتصفير السحب لضمان عدم حدوث تداخلات بالخطأ
            setTimeout(() => { isSpecDragging = false; }, 80);
        });

        // --- 💻 دعم الكمبيوتر (Mouse) لتسهيل التجربة في الـ Inspect ---
        specialistBackBox.addEventListener('mousedown', (e) => {
            isSpecPointerDown = true;
            isSpecDragging = false;
            specStartY = e.clientY;
            specStartTop = parseInt(window.getComputedStyle(specialistBackBox).top, 10) || 25;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isSpecPointerDown) return;
            if (Math.abs(e.clientY - specStartY) > 4) {
                isSpecDragging = true;
            }
            handleSpecPointerMove(e.clientY);
        });

        window.addEventListener('mouseup', () => {
            isSpecPointerDown = false;
            setTimeout(() => { isSpecDragging = false; }, 80);
        });
    }
});