import { toAbsoluteUrl } from '@/lib/helpers';
// import arMessages from './messages/ar.json';
import enMessages from './messages/en.json';
// import frMessages from './messages/fr.json';
// import zhMessages from './messages/zh.json';
import elMessages from './messages/el.json';
import { type Language } from './types';

const I18N_MESSAGES = {
  en: enMessages,
  // ar: arMessages,
  // fr: frMessages,
  // zh: zhMessages,
  el: elMessages,
};

const I18N_CONFIG_KEY = 'i18nConfig';

const I18N_LANGUAGES: Language[] = [
  {
    label: 'Ελληνικά',
    code: 'el',
    direction: 'ltr',
    flag: toAbsoluteUrl('/media/flags/greece.svg'),
    messages: I18N_MESSAGES.el,
  },
  {
    label: 'English',
    code: 'en',
    direction: 'ltr',
    flag: toAbsoluteUrl('/media/flags/united-states.svg'),
    messages: I18N_MESSAGES.en,
  },
];

const I18N_DEFAULT_LANGUAGE: Language = I18N_LANGUAGES[0];

export {
  I18N_CONFIG_KEY,
  I18N_DEFAULT_LANGUAGE,
  I18N_LANGUAGES,
  I18N_MESSAGES,
};
