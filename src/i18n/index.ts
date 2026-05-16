/**
 * i18next 国际化配置
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ru from './locales/ru.json';
import zhCNPlus from './locales-plus/zh-CN.json';
import zhTWPlus from './locales-plus/zh-TW.json';
import enPlus from './locales-plus/en.json';
import ruPlus from './locales-plus/ru.json';
import { getInitialLanguage } from '@/utils/language';

const withPlus = <TBase extends Record<string, any>, TPlus extends Record<string, any>>(
  base: TBase,
  plus: TPlus
) => ({
  ...base,
  auth_login: {
    ...base.auth_login,
    ...plus.auth_login
  }
});

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: withPlus(zhCN, zhCNPlus) },
    'zh-TW': { translation: withPlus(zhTW, zhTWPlus) },
    en: { translation: withPlus(en, enPlus) },
    ru: { translation: withPlus(ru, ruPlus) }
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false // React 已经转义
  },
  react: {
    useSuspense: false
  }
});

export default i18n;
