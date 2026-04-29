import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Language = "ru" | "kk" | "en";

type Dictionary = Record<string, string>;

const languageLabels: Record<Language, string> = {
  ru: "Русский",
  kk: "Қазақша",
  en: "English",
};

const dictionaries: Record<Language, Dictionary> = {
  ru: {
    "nav.home": "Главная",
    "nav.users": "Сотрудники",
    "nav.departments": "Отделы",
    "nav.org": "Оргструктура",
    "nav.admin": "Админка",
    "top.help": "Помощь",
    "top.language": "Язык",
    "top.profile": "Профиль",
    "top.employee": "Сотрудник компании",
    "top.notifications": "Уведомления",
    "top.noNotifications": "Пока уведомлений нет.",
    "top.addNews": "Добавить новость",
    "top.myProfile": "Мой профиль",
    "top.logout": "Выйти",
    "top.planBadge": "За месяц, 600 Тенге",
    "sidebar.pin": "Закрепить панель",
    "sidebar.unpin": "Открепить панель",
    "home.badge": "Главная",
    "home.title": "Новости компании",
    "home.subtitle": "На главной странице отображаются короткие анонсы публикаций. Полный текст открывается внутри новости.",
    "home.loginRequired": "Нужно войти, чтобы видеть новости компании.",
    "home.loadError": "Не удалось загрузить новости.",
    "home.loading": "Загрузка новостей...",
    "home.empty": "Пока новостей нет. Опубликуйте первую запись через панель пользователя.",
    "home.newsTag": "Новость",
    "home.employee": "Сотрудник компании",
    "home.read": "Читать новость",
    "footer.text": "Внутренняя социальная сеть компании Emex.",
  },
  kk: {
    "nav.home": "Басты бет",
    "nav.users": "Қызметкерлер",
    "nav.departments": "Бөлімдер",
    "nav.org": "Құрылым",
    "nav.admin": "Әкімшілік",
    "top.help": "Көмек",
    "top.language": "Тіл",
    "top.profile": "Профиль",
    "top.employee": "Компания қызметкері",
    "top.notifications": "Хабарламалар",
    "top.noNotifications": "Әзірге хабарлама жоқ.",
    "top.addNews": "Жаңалық қосу",
    "top.myProfile": "Менің профилім",
    "top.logout": "Шығу",
    "top.planBadge": "Айына 600 теңге",
    "sidebar.pin": "Панельді бекіту",
    "sidebar.unpin": "Панельді босату",
    "home.badge": "Басты бет",
    "home.title": "Компания жаңалықтары",
    "home.subtitle": "Басты бетте жарияланымдардың қысқа аңдатпалары көрсетіледі. Толық мәтін жаңалық ішінде ашылады.",
    "home.loginRequired": "Компания жаңалықтарын көру үшін жүйеге кіру қажет.",
    "home.loadError": "Жаңалықтарды жүктеу мүмкін болмады.",
    "home.loading": "Жаңалықтар жүктелуде...",
    "home.empty": "Әзірге жаңалық жоқ. Алғашқы жазбаны пайдаланушы панелі арқылы жариялаңыз.",
    "home.newsTag": "Жаңалық",
    "home.employee": "Компания қызметкері",
    "home.read": "Жаңалықты оқу",
    "footer.text": "Emex компаниясының ішкі әлеуметтік желісі.",
  },
  en: {
    "nav.home": "Home",
    "nav.users": "Employees",
    "nav.departments": "Departments",
    "nav.org": "Org chart",
    "nav.admin": "Admin",
    "top.help": "Help",
    "top.language": "Language",
    "top.profile": "Profile",
    "top.employee": "Company employee",
    "top.notifications": "Notifications",
    "top.noNotifications": "No notifications yet.",
    "top.addNews": "Add news",
    "top.myProfile": "My profile",
    "top.logout": "Sign out",
    "top.planBadge": "600 tenge per month",
    "sidebar.pin": "Pin sidebar",
    "sidebar.unpin": "Unpin sidebar",
    "home.badge": "Home",
    "home.title": "Company news",
    "home.subtitle": "The home page shows short publication announcements. The full text opens inside each news item.",
    "home.loginRequired": "Sign in to view company news.",
    "home.loadError": "Could not load news.",
    "home.loading": "Loading news...",
    "home.empty": "No news yet. Publish the first post from the user panel.",
    "home.newsTag": "News",
    "home.employee": "Company employee",
    "home.read": "Read news",
    "footer.text": "Emex internal social network.",
  },
};

type LanguageContextValue = {
  language: Language;
  languageLabel: string;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getSavedLanguage(): Language {
  const saved = localStorage.getItem("app_language");
  return saved === "kk" || saved === "en" || saved === "ru" ? saved : "ru";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getSavedLanguage);

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(nextLanguage: Language) {
      localStorage.setItem("app_language", nextLanguage);
      setLanguageState(nextLanguage);
    }

    function t(key: string) {
      return dictionaries[language][key] ?? dictionaries.ru[key] ?? key;
    }

    return {
      language,
      languageLabel: languageLabels[language],
      setLanguage,
      t,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

export const availableLanguages = Object.entries(languageLabels).map(([value, label]) => ({
  value: value as Language,
  label,
}));
