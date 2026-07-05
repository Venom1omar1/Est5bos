/* ==========================================================================
🎨 THEME SWITCHER - نظام تغيير الثيمات
========================================================================== */

(function() {
  'use strict';

  // ========================================
  // 📌 الثوابت (Constants)
  // ========================================
  const THEME_STORAGE_KEY = 'game-theme';
  const DEFAULT_THEME = 'crimson';
  const THEMES = ['crimson', 'blue', 'green', 'purple', 'gold'];
  
  // ========================================
  // 🎯 العناصر الأساسية
  // ========================================
  const themeStylesheet = document.getElementById('theme-stylesheet');
  const themeRadios = document.querySelectorAll('input[name="game-theme"]');

  // ========================================
  // 🔄 تغيير الثيم
  // ========================================
  function setTheme(themeName) {
    // التأكد إن الثيم موجود في القائمة
    if (!THEMES.includes(themeName)) {
      console.warn(`⚠️ الثيم "${themeName}" غير موجود!`);
      themeName = DEFAULT_THEME;
    }

    // 1️⃣ تغيير الـ data-theme على الـ <html>
    document.documentElement.setAttribute('data-theme', themeName);

    // 2️⃣ تغيير ملف الـ CSS بتاع الثيم
    if (themeStylesheet) {
      themeStylesheet.href = `css/theme-${themeName}.css`;
    }

    // 3️⃣ تحديث الـ radio buttons لو موجودة
    themeRadios.forEach(radio => {
      radio.checked = (radio.value === themeName);
    });

    // 4️⃣ حفظ الثيم في localStorage
    saveTheme(themeName);

    console.log(`✅ تم تغيير الثيم إلى: ${themeName}`);
  }

  // ========================================
  // 💾 حفظ الثيم في localStorage
  // ========================================
  function saveTheme(themeName) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeName);
    } catch (error) {
      console.warn('⚠️ مش قادر أحفظ الثيم في localStorage:', error);
    }
  }

  // ========================================
  // 📥 تحميل الثيم المحفوظ
  // ========================================
  function loadSavedTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && THEMES.includes(savedTheme)) {
        return savedTheme;
      }
    } catch (error) {
      console.warn('⚠️ مش قادر أحمل الثيم المحفوظ:', error);
    }
    return DEFAULT_THEME;
  }

  // ========================================
  // 🎧 Event Listeners
  // ========================================
  function initThemeSwitcher() {
    // 1️⃣ لما المستخدم يدوس على أي radio button
    themeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          setTheme(e.target.value);
        }
      });
    });

    // 2️⃣ تحميل الثيم المحفوظ لما الصفحة تفتح
    const savedTheme = loadSavedTheme();
    setTheme(savedTheme);
  }

  // ========================================
  // 🚀 تشغيل النظام لما الصفحة تخلص تحميل
  // ========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeSwitcher);
  } else {
    initThemeSwitcher();
  }

  // ========================================
  // 🌍 Export للدوال (لو محتاج تستخدمها بره)
  // ========================================
  window.ThemeSwitcher = {
    setTheme: setTheme,
    getTheme: () => localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME,
    resetTheme: () => setTheme(DEFAULT_THEME)
  };

})();