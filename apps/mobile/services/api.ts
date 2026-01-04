import ky from 'ky';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const apiClient = ky.create({
  prefixUrl: API_BASE_URL
});
