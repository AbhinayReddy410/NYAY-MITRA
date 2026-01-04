import auth from '@react-native-firebase/auth';
import firebase from '@react-native-firebase/app';
import type { ReactNativeFirebase } from '@react-native-firebase/app';

const firebaseApp: ReactNativeFirebase.FirebaseApp | null = firebase.apps.length > 0 ? firebase.app() : null;

export const firebaseAuth = auth();
export { firebaseApp };
