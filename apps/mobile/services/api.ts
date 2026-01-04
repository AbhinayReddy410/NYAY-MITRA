import Constants from 'expo-constants';
import ky from 'ky';

type ExpoExtra = {
  apiUrl?: string;
};

const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
const API_BASE_URL = extra?.apiUrl ?? '';

export const apiClient = ky.create({
  prefixUrl: API_BASE_URL
});
