import { useTranslation } from '../i18n/useTranslation';
import type { Locale } from '../i18n/types';

type SettingsPanelProps = {
  onClose: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <span className="modal-card__eyebrow">{t('help.settings')}</span>
          <h2>{t('settings.title')}</h2>
        </div>
        <div className="modal-card__body">
          <div className="settings-section">
            <div className="settings-row">
              <span className="settings-label">{t('settings.language')}</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="settings-select"
              >
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-card__footer">
          <button className="chip" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
