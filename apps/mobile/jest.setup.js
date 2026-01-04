import '@testing-library/jest-native/extend-expect';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
  Link: ({ children, href, ...props }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { ...props, testID: `link-${href}` }, children);
  },
  Redirect: () => null,
  Stack: {
    Screen: () => null,
  },
}));

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => {
  return () => ({
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn(); // unsubscribe function
    }),
    signInWithCredential: jest.fn(),
    signInWithPhoneNumber: jest.fn(),
    signOut: jest.fn(),
    verifyPhoneNumber: jest.fn(),
  });
});

// Mock Firebase App
jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

// Mock Google Sign In
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({
      user: {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
      },
      idToken: 'test-id-token',
    })),
    signOut: jest.fn(() => Promise.resolve()),
    revokeAccess: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: '1',
    IN_PROGRESS: '2',
    PLAY_SERVICES_NOT_AVAILABLE: '3',
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:3000',
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  downloadAsync: jest.fn(() => Promise.resolve({ uri: 'file://test.docx' })),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
  documentDirectory: 'file://documents/',
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(() => Promise.resolve()),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
