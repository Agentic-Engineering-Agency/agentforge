export interface SettingsRecord {
  key: string;
  value: unknown;
}

export interface GeneralSettings {
  defaultModel: string;
  defaultTemperature: number;
}

const DEFAULTS: GeneralSettings = {
  defaultModel: '',
  defaultTemperature: 0.7,
};

export function isSettingsLoaded(
  queryResult: SettingsRecord[] | undefined,
): queryResult is SettingsRecord[] {
  return queryResult !== undefined;
}

export function deriveGeneralSettings(
  settings: SettingsRecord[],
): GeneralSettings {
  const modelEntry = settings.find((s) => s.key === 'defaultModel');
  const tempEntry = settings.find((s) => s.key === 'defaultTemperature');

  return {
    defaultModel:
      modelEntry && typeof modelEntry.value === 'string'
        ? modelEntry.value
        : DEFAULTS.defaultModel,
    defaultTemperature:
      tempEntry && typeof tempEntry.value === 'number'
        ? tempEntry.value
        : DEFAULTS.defaultTemperature,
  };
}
