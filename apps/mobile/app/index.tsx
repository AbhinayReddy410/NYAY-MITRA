import { Redirect } from 'expo-router';

import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';

export function IndexScreen(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Redirect href='/(main)/(home)' />;
  }

  return <Redirect href='/(auth)/login' />;
}
